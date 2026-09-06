import { isOurs, ownsTunnel, type Target, targetsFrom } from "./down.lib";
import { planServices } from "./up.plan";
import {
	findPortHolder,
	isPortFree,
	stopHolder,
	waitForPortFree,
} from "./up.ports";

const FREED_TIMEOUT_MS = 8_000;
const NGROK_API_PORT = 4040;
const NGROK_API = `http://127.0.0.1:${NGROK_API_PORT}/api/tunnels`;

const argv = process.argv.slice(2);
const has = (flag: string): boolean => argv.includes(flag);
const dryRun = has("--dry-run");

const root = (): string => Bun.fileURLToPath(new URL("..", import.meta.url));

const say = (line: string): void => {
	console.log(line);
};

async function matchingPids(match: string): Promise<readonly number[]> {
	try {
		const child = Bun.spawn(["ps", "-Ao", "pid=,command="], {
			stdout: "pipe",
			stderr: "ignore",
		});
		const stdout = await new Response(child.stdout).text();

		await child.exited;

		return stdout
			.split("\n")
			.map((line) => line.trim())
			.filter(
				(line) =>
					line.includes(match) &&
					isOurs(line, root()) &&
					!line.includes("scripts/down.ts"),
			)
			.map((line) => Number(line.split(/\s+/)[0]))
			.filter((pid) => Number.isSafeInteger(pid) && pid !== process.pid);
	} catch {
		return [];
	}
}

async function stopPort(target: Target & { port: number }): Promise<boolean> {
	if (await isPortFree("127.0.0.1", target.port)) {
		return false;
	}

	const holder = await findPortHolder(target.port);

	if (holder === undefined) {
		say(`${target.label}: port ${target.port} is busy but nothing owns it`);

		return false;
	}

	if (dryRun) {
		say(`${target.label}: would stop pid ${holder.pid} on ${target.port}`);

		return true;
	}

	await stopHolder(holder.pid);

	const freed = await waitForPortFree(
		"127.0.0.1",
		target.port,
		FREED_TIMEOUT_MS,
	);

	if (!freed) {
		await stopHolder(holder.pid, "SIGKILL");
		await waitForPortFree("127.0.0.1", target.port, FREED_TIMEOUT_MS);
	}

	say(`${target.label}: stopped pid ${holder.pid} on ${target.port}`);

	return true;
}

async function stopMatching(
	target: Target & { match: string },
): Promise<number> {
	const pids = await matchingPids(target.match);

	for (const pid of pids) {
		if (dryRun) {
			say(`${target.label}: would stop pid ${pid}`);
			continue;
		}

		await stopHolder(pid);
		say(`${target.label}: stopped pid ${pid}`);
	}

	return pids.length;
}

async function stopNgrok(ports: readonly number[]): Promise<number> {
	let tunnels: { config?: { addr?: string } }[];

	try {
		const response = await fetch(NGROK_API, {
			signal: AbortSignal.timeout(1500),
		});

		tunnels =
			((await response.json()) as { tunnels?: typeof tunnels }).tunnels ?? [];
	} catch {
		return 0;
	}

	const ours = tunnels.filter((tunnel) =>
		ownsTunnel(tunnel.config?.addr ?? "", ports),
	);

	if (ours.length === 0) {
		say("ngrok: running, but no tunnel points at this app — left alone");

		return 0;
	}

	const agent = await findPortHolder(NGROK_API_PORT);

	if (agent === undefined) {
		say("ngrok: a tunnel points here but the agent could not be found");

		return 0;
	}

	if (dryRun) {
		say(
			`ngrok: would stop pid ${agent.pid}, serving ${ours.length} tunnel(s) for this app`,
		);

		return ours.length;
	}

	await stopHolder(agent.pid);

	if (!(await waitForPortFree("127.0.0.1", NGROK_API_PORT, FREED_TIMEOUT_MS))) {
		await stopHolder(agent.pid, "SIGKILL");
		await waitForPortFree("127.0.0.1", NGROK_API_PORT, FREED_TIMEOUT_MS);
	}

	say(`ngrok: stopped pid ${agent.pid}, ${ours.length} tunnel(s) for this app`);

	return ours.length;
}

async function stopContainers(): Promise<void> {
	if (dryRun) {
		say("docker: would run docker compose down");

		return;
	}

	const child = Bun.spawn(["docker", "compose", "down"], {
		cwd: root(),
		stdout: "ignore",
		stderr: "ignore",
	});

	say(
		(await child.exited) === 0
			? "docker: containers stopped"
			: "docker: nothing to stop",
	);
}

const services = planServices(Bun.env);
const botPort = Number(Bun.env.BOT_PORT ?? 8768);
const targets = targetsFrom(services, botPort);
const ports = targets
	.map((target) => target.port)
	.filter((port): port is number => port !== undefined);

let stopped = 0;

for (const target of targets) {
	stopped +=
		target.port === undefined
			? await stopMatching(target as Target & { match: string })
			: (await stopPort(target as Target & { port: number }))
				? 1
				: 0;
}

stopped += await stopNgrok(ports);

if (has("--db")) {
	await stopContainers();
}

say("");
say(
	stopped === 0
		? "nothing of this app was running"
		: `${dryRun ? "would stop" : "stopped"} ${stopped} thing(s)`,
);

if (!has("--db")) {
	say("postgres, minio and mailpit are still up — add --db to stop them too");
}
