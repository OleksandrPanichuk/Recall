import { renderLine } from "./up.format";
import {
	describePlan,
	type PlannedService,
	planServices,
	running,
	SERVICE_NAMES,
	selectionFrom,
} from "./up.plan";
import {
	findPortHolder,
	isPortFree,
	killCommand,
	openInBrowser,
	waitForHttp,
} from "./up.ports";
import { type SupervisedProcess, superviseProcesses } from "./up.supervise";

const READY_TIMEOUT_MS = 15_000;

const entrypoint = (file: string): string =>
	Bun.fileURLToPath(new URL(`../src/entrypoints/${file}`, import.meta.url));

const script = (file: string): string =>
	Bun.fileURLToPath(new URL(file, import.meta.url));

const argv = process.argv.slice(2);
const has = (flag: string): boolean => argv.includes(flag);
const colour = process.stdout.isTTY === true && !has("--no-colour");
const raw = has("--raw");

const say = (line: string): void => {
	console.log(line);
};

const complain = (line: string): void => {
	console.error(line);
};

function pump(
	stream: ReadableStream<Uint8Array> | null,
	render: (line: string) => string,
	write: (line: string) => void,
): Promise<void> {
	if (stream === null) {
		return Promise.resolve();
	}

	return (async () => {
		const decoder = new TextDecoder();
		let rest = "";

		for await (const chunk of stream) {
			rest += decoder.decode(chunk, { stream: true });

			const lines = rest.split("\n");
			rest = lines.pop() ?? "";

			for (const line of lines) {
				write(render(line));
			}
		}

		if (rest.length > 0) {
			write(render(rest));
		}
	})();
}

const drains: Promise<void>[] = [];

function start(
	service: PlannedService,
	width: number,
	index: number,
): SupervisedProcess {
	const child = Bun.spawn([process.execPath, entrypoint(service.entry)], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const render = (line: string): string =>
		raw
			? `${service.name.padEnd(width)}  ${line}`
			: renderLine(service.name, width, line, { colour, index });

	drains.push(pump(child.stdout, render, say));
	drains.push(pump(child.stderr, render, complain));

	return {
		name: service.name,
		exited: child.exited,
		kill: () => child.kill("SIGTERM"),
	};
}

async function migrateOrExit(): Promise<void> {
	const child = Bun.spawn([process.execPath, script("./migrate.ts")], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const output: string[] = [];
	const collect = (line: string): void => {
		if (line.trim().length > 0) {
			output.push(line);
		}
	};

	const drained = Promise.all([
		pump(child.stdout, (line) => line, collect),
		pump(child.stderr, (line) => line, collect),
	]);
	const code = await child.exited;

	await drained;

	if (code !== 0) {
		for (const line of output) {
			complain(line);
		}

		complain("nothing was started because the migrations failed");
		process.exit(code);
	}
}

async function checkPortsOrExit(
	services: readonly PlannedService[],
): Promise<void> {
	const taken: string[] = [];

	for (const service of services) {
		if (service.port === undefined || service.host === undefined) {
			continue;
		}

		if (await isPortFree(service.host, service.port)) {
			continue;
		}

		const holder = await findPortHolder(service.port);

		taken.push(
			holder === undefined
				? `port ${service.port} (${service.name}) is already in use`
				: `port ${service.port} (${service.name}) is held by pid ${holder.pid}${
						holder.command === undefined ? "" : ` (${holder.command})`
					} — stop it with: ${killCommand(holder.pid, process.platform)}`,
		);
	}

	if (taken.length > 0) {
		complain("");

		for (const line of taken) {
			complain(line);
		}

		process.exit(1);
	}
}

async function announceReady(
	services: readonly PlannedService[],
	startedAt: number,
): Promise<void> {
	const probes = services.filter(
		(service): service is PlannedService & { url: string } =>
			service.url !== undefined,
	);
	const answers = await Promise.all(
		probes.map(async (service) => ({
			name: service.name,
			url: service.url,
			ready: await waitForHttp(service.url, READY_TIMEOUT_MS),
		})),
	);
	const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

	for (const answer of answers) {
		if (!answer.ready) {
			complain(`${answer.name} did not answer on ${answer.url} yet`);
		}
	}

	say("");

	const label = Math.max(0, ...answers.map((answer) => answer.name.length));

	for (const answer of answers) {
		say(`${answer.name.padEnd(label)} → ${answer.url}`);
	}

	const admin = services.find((service) => service.name === "admin");

	if (admin?.url !== undefined) {
		const passphrase = (
			Bun.env.ADMIN_PASSPHRASE ??
			Bun.env.MCP_OAUTH_PASSPHRASE ??
			""
		).trim();

		say(
			has("--show-passphrase")
				? `admin password: ${passphrase}`
				: "admin password: run with --show-passphrase to print it",
		);
	}

	say(`ready in ${seconds}s — Ctrl+C to stop`);
	say("");

	if (has("--open") && admin?.url !== undefined) {
		openInBrowser(admin.url);
	}
}

const selection = selectionFrom(argv);

if (selection.unknown.length > 0) {
	complain(
		`unknown service ${selection.unknown.join(", ")} — pick from ${SERVICE_NAMES.join(", ")}`,
	);
	process.exit(1);
}

const plan = planServices(Bun.env, selection.only);
const services = running(plan);
const width = Math.max(...plan.map((service) => service.name.length));

for (const line of describePlan(plan)) {
	say(line);
}

if (services.length === 0) {
	complain("nothing to start");
	process.exit(1);
}

await checkPortsOrExit(services);

if (has("--check")) {
	say("configuration is valid and every port is free");
	process.exit(0);
}

await migrateOrExit();

const startedAt = Date.now();
const children = services.map((service, index) => start(service, width, index));

let stopping = false;

const stop = (): void => {
	if (stopping) {
		return;
	}

	stopping = true;
	say("stopping…");

	for (const child of children) {
		child.kill();
	}
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

void announceReady(services, startedAt);

const first = await superviseProcesses(children);

await Promise.all(drains);

if (stopping) {
	say("stopped");
	process.exit(0);
}

if (first !== undefined) {
	complain(`${first.name} exited with ${first.code}, so everything stopped`);
	process.exit(first.code === 0 ? 1 : first.code);
}
