import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
	createMutableClock,
	createSequentialIdGenerator,
} from "@tests/fixtures/application.fixture";
import { createMcpServer, MCP_SERVER_NAME } from "@/adapters/mcp/server";
import {
	type Application,
	createApplication,
} from "@/composition/create-application";
import { QuestionType } from "@/domain/quiz-set/question";

let application: Application;
let client: Client;

const aQuestion = (
	prompt: string,
	overrides: Record<string, unknown> = {},
) => ({
	type: QuestionType.SingleChoice,
	prompt,
	difficulty: "medium",
	explanation: `Explanation for ${prompt}`,
	options: [
		{ text: `Right for ${prompt}`, isCorrect: true },
		{ text: `Wrong for ${prompt}`, isCorrect: false },
	],
	...overrides,
});

interface ToolOutcome {
	readonly text: string;
	readonly isError: boolean;
	readonly structured: Record<string, unknown>;
}

async function call(
	name: string,
	args: Record<string, unknown> = {},
): Promise<ToolOutcome> {
	const result = (await client.callTool({ name, arguments: args })) as {
		content?: { type: string; text?: string }[];
		isError?: boolean;
		structuredContent?: Record<string, unknown>;
	};

	return {
		text: (result.content ?? []).map((entry) => entry.text ?? "").join("\n"),
		isError: result.isError === true,
		structured: result.structuredContent ?? {},
	};
}

const newDraft = async (title = "Bun persistence"): Promise<string> => {
	const created = await call("quiz_create_set", { title, language: "uk" });

	return String(created.structured.quizSetId);
};

beforeEach(async () => {
	application = createApplication({
		databasePath: ":memory:",
		clock: createMutableClock(),
		idGenerator: createSequentialIdGenerator("q"),
	});

	const server = createMcpServer(application);
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

describe("MCP server (§4.1)", () => {
	test("completes the handshake and reports the server", () => {
		expect(client.getServerVersion()?.name).toBe(MCP_SERVER_NAME);
	});

	test("lists every authoring tool", async () => {
		const { tools } = await client.listTools();

		expect(tools.map((tool) => tool.name).toSorted()).toEqual([
			"quiz_add_questions",
			"quiz_archive_set",
			"quiz_create_set",
			"quiz_get_set",
			"quiz_list_sets",
			"quiz_publish_set",
			"quiz_update_set",
		]);
	});

	test("advertises an input schema for every tool", async () => {
		const { tools } = await client.listTools();

		for (const tool of tools) {
			expect(tool.inputSchema.type).toBe("object");
		}
	});
});

describe("write tools (§4.2)", () => {
	test("creates a draft and returns its id", async () => {
		const result = await call("quiz_create_set", {
			title: "Bun persistence",
			language: "uk",
		});

		expect(result.isError).toBe(false);
		expect(String(result.structured.quizSetId)).toBe("q-1");
		expect(result.text).toContain("Created draft quiz set");
	});

	test("rejects an empty title through schema validation", async () => {
		const result = await call("quiz_create_set", {
			title: "",
			language: "uk",
		});

		expect(result.isError).toBe(true);
		expect(
			(await call("quiz_list_sets", { includeUnpublished: true })).text,
		).toBe("No quiz sets yet.");
	});

	test("adds a batch and reports the ids", async () => {
		const quizSetId = await newDraft();

		const result = await call("quiz_add_questions", {
			quizSetId,
			questions: [aQuestion("One"), aQuestion("Two")],
		});

		expect(result.isError).toBe(false);
		expect(result.structured.addedQuestionIds).toHaveLength(2);
	});

	// Adding questions and stopping there is the easy mistake: the call succeeds,
	// and the set never reaches Telegram because it is still a draft.
	test("adding questions says the set is not published yet", async () => {
		const quizSetId = await newDraft();

		const result = await call("quiz_add_questions", {
			quizSetId,
			questions: [aQuestion("One")],
		});

		expect(result.text).toContain("still a DRAFT");
		expect(result.text).toContain("quiz_publish_set");
		expect(result.structured.nextStep).toBe("quiz_publish_set");
	});

	// §4.2 gate: an invalid batch rolls back entirely.
	test("an invalid question rolls the whole batch back", async () => {
		const quizSetId = await newDraft();

		const result = await call("quiz_add_questions", {
			quizSetId,
			questions: [
				aQuestion("Good"),
				aQuestion("Bad", {
					options: [
						{ text: "Both", isCorrect: true },
						{ text: "Correct", isCorrect: true },
					],
				}),
			],
		});

		expect(result.isError).toBe(true);
		expect(result.text).toContain("requires exactly one correct option");
		expect((await call("quiz_get_set", { quizSetId })).text).toContain(
			"no questions yet",
		);
	});

	// §4.2 gate: batch size has an upper bound.
	test("an oversized batch is refused by the schema", async () => {
		const quizSetId = await newDraft();

		const result = await call("quiz_add_questions", {
			quizSetId,
			questions: Array.from({ length: 51 }, (_value, index) =>
				aQuestion(`Question ${index}`),
			),
		});

		expect(result.isError).toBe(true);
		expect((await call("quiz_get_set", { quizSetId })).text).toContain(
			"no questions yet",
		);
	});

	test("replaying a batch is a safe no-op", async () => {
		const quizSetId = await newDraft();
		const questions = [aQuestion("One")];
		await call("quiz_add_questions", { quizSetId, questions });

		const replay = await call("quiz_add_questions", { quizSetId, questions });

		expect(replay.isError).toBe(false);
		expect(replay.text).toContain("No change");
		expect(replay.structured.addedQuestionIds).toEqual([]);
	});

	test("publishing an empty set explains the rule", async () => {
		const quizSetId = await newDraft();

		const result = await call("quiz_publish_set", { quizSetId });

		expect(result.isError).toBe(true);
		expect(result.text).toContain("needs at least one question");
	});

	test("editing a published set is refused with a reason", async () => {
		const quizSetId = await newDraft();
		await call("quiz_add_questions", {
			quizSetId,
			questions: [aQuestion("One")],
		});
		await call("quiz_publish_set", { quizSetId });

		const result = await call("quiz_update_set", { quizSetId, title: "New" });

		expect(result.isError).toBe(true);
		expect(result.text).toContain("immutable");
	});

	test("an unknown set id points at the listing tool", async () => {
		const result = await call("quiz_get_set", { quizSetId: "missing" });

		expect(result.isError).toBe(true);
		expect(result.text).toContain("quiz_list_sets");
	});
});

describe("read tools (§4.3)", () => {
	test("get_set shows questions with the correct option marked", async () => {
		const quizSetId = await newDraft();
		await call("quiz_add_questions", {
			quizSetId,
			questions: [aQuestion("One")],
		});

		const result = await call("quiz_get_set", { quizSetId });

		expect(result.text).toContain("* Right for One");
		expect(result.text).toContain("- Wrong for One");
		expect(result.structured.questionCount).toBe(1);
	});

	test("list_sets hides drafts unless asked, but says they exist", async () => {
		const quizSetId = await newDraft("Draft only");

		const published = await call("quiz_list_sets");

		expect(published.text).toContain("1 unpublished set(s) not shown");
		expect(published.structured.unpublishedCount).toBe(1);

		const all = await call("quiz_list_sets", { includeUnpublished: true });

		expect(all.text).toContain(quizSetId);
		expect(all.structured.count).toBe(1);
	});
});

// §4.4: the authoring scenario the plan describes, with no direct database access.
describe("end-to-end authoring (§4.4)", () => {
	test("Claude can draft in batches, re-read, publish, and hand over to Telegram", async () => {
		const quizSetId = await newDraft("Designing Data-Intensive Applications");

		await call("quiz_add_questions", {
			quizSetId,
			questions: [aQuestion("What is a WAL?"), aQuestion("What is a B-tree?")],
		});
		await call("quiz_add_questions", {
			quizSetId,
			questions: [aQuestion("What is an LSM tree?")],
		});

		const review = await call("quiz_get_set", { quizSetId });

		expect(review.text).toContain("status: draft");
		expect(review.structured.questionCount).toBe(3);

		const published = await call("quiz_publish_set", { quizSetId });

		expect(published.isError).toBe(false);
		expect((await call("quiz_list_sets")).text).toContain(quizSetId);

		// The Telegram side sees exactly what MCP published, through the same
		// application services and with no SQL in between.
		const forTelegram = await application.listQuizSets.execute({});

		expect(forTelegram).toHaveLength(1);
		expect(forTelegram[0]?.questionCount).toBe(3);
	});
});
