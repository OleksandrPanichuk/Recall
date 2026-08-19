import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	createMutableClock,
	createSequentialIdGenerator,
} from "@tests/fixtures/application.fixture";
import { createRecordingLogger } from "@tests/fixtures/logger.fixture";
import {
	type Application,
	createApplication,
} from "@/composition/create-application";
import { createMcpHttpHandler } from "./handler";

const TOKEN = "t".repeat(40);
const URL_MCP = "http://127.0.0.1:8765/mcp";

let application: Application;
let handle: (request: Request) => Promise<Response>;
let logger: ReturnType<typeof createRecordingLogger>;

const rpc = (
	method: string,
	params: Record<string, unknown> = {},
	id = 1,
): string => JSON.stringify({ jsonrpc: "2.0", id, method, params });

const post = (body: string, token: string | null = TOKEN): Request =>
	new Request(URL_MCP, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json, text/event-stream",
			...(token === null ? {} : { authorization: `Bearer ${token}` }),
		},
		body,
	});

const bodyOf = async (response: Response): Promise<Record<string, never>> =>
	(await response.json()) as Record<string, never>;

beforeEach(() => {
	application = createApplication({
		databasePath: ":memory:",
		clock: createMutableClock(),
		idGenerator: createSequentialIdGenerator("q"),
	});
	logger = createRecordingLogger();
	handle = createMcpHttpHandler({
		application,
		logger,
		token: TOKEN,
		allowedHosts: [],
	});
});

afterEach(() => {
	application.close();
});

describe("without a usable token", () => {
	test("refuses a request with no authorization at all", async () => {
		const response = await handle(post(rpc("tools/list"), null));

		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toContain("Bearer");
	});

	test("refuses the wrong token", async () => {
		expect((await handle(post(rpc("tools/list"), "x".repeat(40)))).status).toBe(
			401,
		);
	});

	test("refuses another scheme", async () => {
		const response = await handle(
			new Request(URL_MCP, {
				method: "POST",
				headers: { authorization: `Basic ${TOKEN}` },
				body: rpc("tools/list"),
			}),
		);

		expect(response.status).toBe(401);
	});

	test("says a request was refused without printing the token", async () => {
		await handle(post(rpc("tools/list"), "x".repeat(40)));

		expect(logger.text()).toContain("refused");
		expect(logger.text()).not.toContain("x".repeat(40));
	});
});

describe("with the configured token", () => {
	test("answers the handshake", async () => {
		const response = await handle(
			post(
				rpc("initialize", {
					protocolVersion: "2025-06-18",
					capabilities: {},
					clientInfo: { name: "test", version: "0.0.0" },
				}),
			),
		);

		expect(response.status).toBe(200);
		expect(JSON.stringify(await bodyOf(response))).toContain("serverInfo");
	});

	test("lists the authoring tools", async () => {
		const response = await handle(post(rpc("tools/list")));

		expect(response.status).toBe(200);
		expect(JSON.stringify(await bodyOf(response))).toContain("quiz_create_set");
	});

	test("runs a tool against the shared database", async () => {
		const created = await handle(
			post(
				rpc("tools/call", {
					name: "quiz_create_set",
					arguments: { title: "Remote", language: "uk" },
				}),
			),
		);

		expect(created.status).toBe(200);

		const listed = await handle(
			post(
				rpc("tools/call", {
					name: "quiz_list_sets",
					arguments: { includeUnpublished: true },
				}),
				TOKEN,
			),
		);

		expect(JSON.stringify(await bodyOf(listed))).toContain("Remote");
	});
});

describe("routing", () => {
	test("serves nothing outside /mcp", async () => {
		const response = await handle(
			new Request("http://127.0.0.1:8765/", {
				method: "POST",
				headers: { authorization: `Bearer ${TOKEN}` },
				body: rpc("tools/list"),
			}),
		);

		expect(response.status).toBe(404);
	});
});
