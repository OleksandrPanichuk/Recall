import { type SupervisedProcess, superviseProcesses } from "./up.supervise";

const entrypoint = (file: string): string =>
	Bun.fileURLToPath(new URL(`../src/entrypoints/${file}`, import.meta.url));

const script = (file: string): string =>
	Bun.fileURLToPath(new URL(file, import.meta.url));

async function migrateOrExit(): Promise<void> {
	const child = Bun.spawn([process.execPath, script("./migrate.ts")], {
		stdout: "inherit",
		stderr: "inherit",
	});

	const code = await child.exited;

	if (code !== 0) {
		console.error("[up] Migrations failed, so nothing was started");
		process.exit(code);
	}
}

function pump(
	stream: ReadableStream<Uint8Array> | null,
	prefix: string,
	write: (line: string) => void,
): void {
	if (stream === null) {
		return;
	}

	void (async () => {
		const decoder = new TextDecoder();
		let rest = "";

		for await (const chunk of stream) {
			rest += decoder.decode(chunk, { stream: true });

			const lines = rest.split("\n");
			rest = lines.pop() ?? "";

			for (const line of lines) {
				write(`${prefix}${line}`);
			}
		}

		if (rest.length > 0) {
			write(`${prefix}${rest}`);
		}
	})();
}

function start(name: string, file: string): SupervisedProcess {
	const child = Bun.spawn([process.execPath, entrypoint(file)], {
		stdout: "pipe",
		stderr: "pipe",
	});

	pump(child.stdout, `[${name}]`, (line) => console.log(line));
	pump(child.stderr, `[${name}]`, (line) => console.error(line));

	return { name, exited: child.exited, kill: () => child.kill("SIGTERM") };
}

await migrateOrExit();

const children: SupervisedProcess[] = [start("bot", "telegram.ts")];

if ((Bun.env.MCP_HTTP_TOKEN ?? "").trim().length === 0) {
	console.log("[up] MCP_HTTP_TOKEN is not set, so only the bot is running");
} else {
	children.push(start("mcp", "mcp-http.ts"));
}

const stop = (): void => {
	for (const child of children) {
		child.kill();
	}
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

const first = await superviseProcesses(children);

if (first !== undefined && first.code !== 0) {
	console.error(`[up] ${first.name} exited with ${first.code}`);
	process.exit(first.code);
}
