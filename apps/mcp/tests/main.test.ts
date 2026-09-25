import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const TOKEN = "m".repeat(40);

const bridgeEntry = Bun.fileURLToPath(
	new URL("../src/main.ts", import.meta.url),
);

let stub: ReturnType<typeof Bun.serve>;

beforeAll(() => {
	stub = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		fetch: async (request) => {
			const message = (await request.json()) as { id?: unknown };

			await Bun.sleep(50);

			return Response.json({
				jsonrpc: "2.0",
				id: message.id,
				result: { echoed: true },
			});
		},
	});
});

afterAll(() => {
	stub.stop(true);
});

const run = async (input: string): Promise<string[]> => {
	const bridge = Bun.spawn(
		[process.execPath, "--env-file=/dev/null", bridgeEntry],
		{
			env: {
				PATH: process.env.PATH ?? "",
				MCP_HTTP_TOKEN: TOKEN,
				RECALL_API_MCP_URL: `http://127.0.0.1:${stub.port}/mcp`,
			},
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
		},
	);

	bridge.stdin.write(input);
	await bridge.stdin.end();

	const output = await new Response(bridge.stdout).text();

	await bridge.exited;

	return output
		.split("\n")
		.filter((line) => line.trim().length > 0)
		.map((line) => String((JSON.parse(line) as { id: unknown }).id));
};

describe("the bridge's stdio loop", () => {
	test("answers a last line that has no trailing newline", async () => {
		expect(
			await run(JSON.stringify({ jsonrpc: "2.0", id: 9, method: "ping" })),
		).toEqual(["9"]);
	});

	test("answers every line before it exits once stdin closes", async () => {
		const input = [1, 2, 3]
			.map((id) => JSON.stringify({ jsonrpc: "2.0", id, method: "ping" }))
			.join("\n");

		expect((await run(`${input}\n`)).sort()).toEqual(["1", "2", "3"]);
	});
});
