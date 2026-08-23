import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
	createRecordingLogger,
	type RecordingLogger,
} from "@tests/fixtures/logger.fixture";
import {
	createMutableClock,
	createSequentialIdGenerator,
} from "@tests/fixtures/memory.fixture";
import { createMcpServer } from "@/adapters/mcp/server";
import {
	type Application,
	createApplication,
} from "@/composition/create-application";
import { QuestionType } from "@/domain/quiz-set/question";

let application: Application;
let client: Client;
let logger: RecordingLogger;

const PROMPT = "Which Bun API replaces better-sqlite3?";

const call = (
	name: string,
	args: Record<string, unknown> = {},
): Promise<unknown> => client.callTool({ name, arguments: args });

beforeEach(async () => {
	logger = createRecordingLogger();
	application = createApplication({
		databasePath: ":memory:",
		clock: createMutableClock(),
		idGenerator: createSequentialIdGenerator("q"),
		logger,
	});

	const server = createMcpServer(application, { logger });
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();

	client = new Client({ name: "test-client", version: "0.0.0" });

	await Promise.all([
		server.connect(serverTransport),
		client.connect(clientTransport),
	]);
});

afterEach(async () => {
	await client.close();
	application.close();
});

describe("MCP tool logging (§6.2)", () => {
	test("logs every tool the authoring client calls", async () => {
		await call("quiz_create_set", { title: "Bun", language: "uk" });
		await call("quiz_list_sets", {});

		expect(logger.of("mcp tool").map((record) => record.tool)).toEqual([
			"quiz_create_set",
			"quiz_list_sets",
		]);
	});

	test("records the set and the batch size of an import", async () => {
		await call("quiz_create_set", { title: "Bun", language: "uk" });
		await call("quiz_add_questions", {
			quizSetId: "q-1",
			questions: [
				{
					type: QuestionType.SingleChoice,
					prompt: PROMPT,
					difficulty: "medium",
					explanation: `Explanation for ${PROMPT}`,
					options: [
						{ text: "bun:sqlite", isCorrect: true },
						{ text: "node:sqlite", isCorrect: false },
					],
				},
			],
		});

		expect(logger.of("mcp tool").at(-1)).toMatchObject({
			tool: "quiz_add_questions",
			quizSetId: "q-1",
			questionCount: 1,
			outcome: "ok",
		});
		expect(logger.text()).not.toContain("Bun API");
		expect(logger.text()).not.toContain("bun:sqlite");
	});

	test("logs a folder path as a path, not as content", async () => {
		await call("quiz_ensure_folder_path", { path: ["English", "A1"] });

		expect(logger.of("mcp tool").at(-1)).toMatchObject({
			tool: "quiz_ensure_folder_path",
			folderPath: "English / A1",
		});
	});

	test("reports a rejected call with the error behind it", async () => {
		await call("quiz_publish_set", { quizSetId: "missing" });

		expect(logger.of("mcp tool failed").at(0)).toMatchObject({
			level: "error",
			tool: "quiz_publish_set",
			quizSetId: "missing",
			error: { name: "QuizSetNotFoundError" },
		});
	});
});
