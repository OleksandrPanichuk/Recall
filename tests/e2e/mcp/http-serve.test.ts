import { afterEach, beforeEach, expect, test } from "bun:test";

const entrypoint = Bun.fileURLToPath(
	new URL("../../../src/entrypoints/mcp-http.ts", import.meta.url),
);

const TOKEN = "e".repeat(40);
const PORT = 8799;
const URL_MCP = `http://127.0.0.1:${PORT}/mcp`;

let child: ReturnType<typeof Bun.spawn> | undefined;

const rpc = (method: string): string =>
	JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: {} });

const ask = (token?: string): Promise<Response> =>
	fetch(URL_MCP, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json, text/event-stream",
			...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
		},
		body: rpc("tools/list"),
	});

beforeEach(async () => {
	child = Bun.spawn([process.execPath, "--env-file=/dev/null", entrypoint], {
		env: {
			TELEGRAM_BOT_KEY: "123456789:AA-serve-test",
			ALLOWED_TELEGRAM_USER_ID: "987654321",
			DATABASE_PATH: ":memory:",
			APP_TIMEZONE: "Europe/Kyiv",
			MCP_HTTP_TOKEN: TOKEN,
			MCP_HTTP_PORT: String(PORT),
		},
		stdout: "pipe",
		stderr: "pipe",
	});

	for (let attempt = 0; attempt < 100; attempt += 1) {
		try {
			await ask(TOKEN);

			return;
		} catch {
			await Bun.sleep(50);
		}
	}

	throw new Error("the http entrypoint never started listening");
});

afterEach(() => {
	child?.kill();
});

test("serves the tools over real http, but only with the token", async () => {
	expect((await ask()).status).toBe(401);
	expect((await ask("w".repeat(40))).status).toBe(401);

	const allowed = await ask(TOKEN);

	expect(allowed.status).toBe(200);
	expect(JSON.stringify(await allowed.json())).toContain("quiz_create_set");
});
