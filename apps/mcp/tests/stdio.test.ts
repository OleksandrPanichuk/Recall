import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
	seedTelegramOwner,
} from "@api-tests/fixtures/postgres";
import {
	makeTempDirectory,
	removeTempDirectory,
} from "@api-tests/fixtures/temp-dir";

const available = await postgresAvailable();

const TOKEN = "b".repeat(40);
const PORT = 8791;

const api = Bun.fileURLToPath(
	new URL("../../api/src/entrypoints/api.ts", import.meta.url),
);
const bridgeEntry = Bun.fileURLToPath(
	new URL("../src/main.ts", import.meta.url),
);

let harness: PostgresHarness;
let directory: string;
let apiProcess: ReturnType<typeof Bun.spawn> | undefined;
let bridge: ReturnType<typeof Bun.spawn> | undefined;
let lines: AsyncIterableIterator<string>;

const readLines = async function* (
	stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
	const decoder = new TextDecoder();
	let pending = "";

	for await (const chunk of stream) {
		pending += decoder.decode(chunk, { stream: true });

		const parts = pending.split("\n");

		pending = parts.pop() ?? "";

		for (const part of parts) {
			if (part.trim().length > 0) {
				yield part;
			}
		}
	}
};

const ask = async (message: Record<string, unknown>): Promise<unknown> => {
	const writer = bridge?.stdin as unknown as {
		write(data: string): void;
		flush(): Promise<number>;
	};

	writer.write(`${JSON.stringify(message)}\n`);
	await writer.flush();

	const next = await lines.next();

	if (next.done === true) {
		throw new Error("the bridge closed its output");
	}

	return JSON.parse(next.value);
};

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("mcp-bridge");
	await applyMigration(harness);
	await seedTelegramOwner(harness, 987654321);
	directory = makeTempDirectory("recall-mcp-bridge-");

	apiProcess = Bun.spawn([process.execPath, "--env-file=/dev/null", api], {
		env: {
			PATH: process.env.PATH ?? "",
			DATABASE_URL: harness.url,
			APP_TIMEZONE: "Europe/Kyiv",
			ALLOWED_TELEGRAM_USER_ID: "987654321",
			TELEGRAM_BOT_KEY: "123456789:AA-bridge-test",
			MCP_HTTP_TOKEN: TOKEN,
			OAUTH_DATABASE_PATH: join(directory, "oauth.sqlite"),
			API_PORT: String(PORT),
		},
		stdout: "pipe",
		stderr: "pipe",
	});

	for (let attempt = 0; attempt < 200; attempt += 1) {
		try {
			const response = await fetch(`http://127.0.0.1:${PORT}/health/live`);

			if (response.ok) {
				break;
			}
		} catch {
			// the api is not listening yet
		}

		await Bun.sleep(50);
	}

	bridge = Bun.spawn([process.execPath, "--env-file=/dev/null", bridgeEntry], {
		env: {
			PATH: process.env.PATH ?? "",
			MCP_HTTP_TOKEN: TOKEN,
			RECALL_API_MCP_URL: `http://127.0.0.1:${PORT}/mcp`,
		},
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
	});

	lines = readLines(bridge.stdout as ReadableStream<Uint8Array>);
});

afterAll(async () => {
	bridge?.kill();
	apiProcess?.kill();
	await harness?.close();

	if (directory !== undefined) {
		removeTempDirectory(directory);
	}
});

describe.skipIf(!available)("the mcp app over stdio", () => {
	test("completes the handshake through the api", async () => {
		const answer = (await ask({
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-06-18",
				capabilities: {},
				clientInfo: { name: "stdio-test", version: "0" },
			},
		})) as { result?: { serverInfo?: { name?: string } } };

		expect(answer.result?.serverInfo?.name).toBeString();
	});

	test("lists the tools the api serves", async () => {
		const answer = (await ask({
			jsonrpc: "2.0",
			id: 2,
			method: "tools/list",
			params: {},
		})) as { result?: { tools?: { name: string }[] } };

		expect(answer.result?.tools?.map((tool) => tool.name)).toContain(
			"quiz_create_set",
		);
	});

	test("writes to the database the api owns, and reads it back", async () => {
		await ask({
			jsonrpc: "2.0",
			id: 3,
			method: "tools/call",
			params: {
				name: "quiz_create_set",
				arguments: { title: "Through the bridge", language: "en" },
			},
		});

		const listed = (await ask({
			jsonrpc: "2.0",
			id: 4,
			method: "tools/call",
			params: {
				name: "quiz_list_sets",
				arguments: { includeUnpublished: true },
			},
		})) as unknown;

		expect(JSON.stringify(listed)).toContain("Through the bridge");
	});

	test("keeps a notification silent instead of answering it", async () => {
		const writer = bridge?.stdin as unknown as {
			write(data: string): void;
			flush(): Promise<number>;
		};

		writer.write(
			`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
		);
		await writer.flush();

		const answer = (await ask({
			jsonrpc: "2.0",
			id: 5,
			method: "tools/list",
			params: {},
		})) as { id?: number };

		expect(answer.id).toBe(5);
	});
});
