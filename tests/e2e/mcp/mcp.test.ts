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
			"quiz_add_vocabulary",
			"quiz_archive_set",
			"quiz_create_set",
			"quiz_delete_folder",
			"quiz_ensure_folder_path",
			"quiz_get_repetition_settings",
			"quiz_get_set",
			"quiz_list_folders",
			"quiz_list_sets",
			"quiz_move_set",
			"quiz_publish_set",
			"quiz_rename_folder",
			"quiz_set_repetition_settings",
			"quiz_update_set",
			"quiz_update_vocabulary",
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

		const forTelegram = await application.listQuizSets.execute({});

		expect(forTelegram).toHaveLength(1);
		expect(forTelegram[0]?.questionCount).toBe(3);
	});
});

describe("folders over MCP", () => {
	const path = ["English", "Vocabulary", "By levels", "A1"];

	const ensure = async (
		segments: readonly string[] = path,
	): Promise<ToolOutcome> =>
		call("quiz_ensure_folder_path", { path: [...segments] });

	const publishedSetIn = async (
		folderPath: readonly string[],
		title = "A1 words",
	): Promise<string> => {
		const created = await call("quiz_create_set", {
			title,
			language: "en",
			folderPath: [...folderPath],
		});
		const quizSetId = String(created.structured.quizSetId);

		await call("quiz_add_questions", {
			quizSetId,
			questions: [aQuestion("apple")],
		});
		await call("quiz_publish_set", { quizSetId });

		return quizSetId;
	};

	test("reports an empty library", async () => {
		const result = await call("quiz_list_folders");

		expect(result.isError).toBe(false);
		expect(result.text).toContain("No folders yet");
	});

	test("creates a path and reports every segment it made", async () => {
		const result = await ensure();

		expect(result.isError).toBe(false);
		expect(result.structured.created).toEqual(path);
		expect(String(result.structured.folderId).length).toBeGreaterThan(0);
	});

	test("is idempotent", async () => {
		const first = await ensure();
		const second = await ensure();

		expect(second.structured.folderId).toBe(first.structured.folderId);
		expect(second.structured.created).toEqual([]);
	});

	test("creates only the missing tail", async () => {
		await ensure(["English", "Vocabulary"]);

		expect((await ensure()).structured.created).toEqual(["By levels", "A1"]);
	});

	test("files a set at creation and counts it in the tree", async () => {
		await publishedSetIn(path);

		const tree = await call("quiz_list_folders");

		expect(tree.text).toContain("A1 (1 set)");
		expect(tree.text).toContain("English");
	});

	test("renders the tree indented by depth", async () => {
		await ensure(["English", "Vocabulary"]);

		const lines = (await call("quiz_list_folders")).text.split("\n");

		expect(lines[0]).toBe("English (0 sets)");
		expect(lines[1]).toBe("  Vocabulary (0 sets)");
	});

	test("returns a flat structure alongside the text", async () => {
		await ensure(["English", "Vocabulary"]);

		const folders = (await call("quiz_list_folders")).structured.folders as {
			readonly name: string;
			readonly parentId?: string;
		}[];

		expect(folders).toHaveLength(2);
		expect(folders.find((f) => f.name === "English")?.parentId).toBeUndefined();
		expect(
			folders.find((f) => f.name === "Vocabulary")?.parentId,
		).toBeDefined();
	});

	test("moves a set between folders and back to unfiled", async () => {
		const quizSetId = await publishedSetIn(path);
		const target = await ensure(["Programming", "SQL"]);

		const moved = await call("quiz_move_set", {
			quizSetId,
			folderPath: ["Programming", "SQL"],
		});

		expect(moved.isError).toBe(false);
		expect(moved.structured.folderId).toBe(target.structured.folderId);

		const unfiled = await call("quiz_move_set", { quizSetId });

		expect(unfiled.isError).toBe(false);
		expect((await call("quiz_list_folders")).text).toContain("SQL (0 sets)");
	});

	test("renames a folder", async () => {
		await ensure(["Enlgish"]);

		const renamed = await call("quiz_rename_folder", {
			path: ["Enlgish"],
			name: "English",
		});

		expect(renamed.isError).toBe(false);
		expect((await call("quiz_list_folders")).text).toContain("English");
	});

	test("refuses a rename that collides with a sibling", async () => {
		await ensure(["English", "Vocabulary"]);
		await ensure(["English", "Grammar"]);

		const result = await call("quiz_rename_folder", {
			path: ["English", "Grammar"],
			name: "vocabulary",
		});

		expect(result.isError).toBe(true);
		expect(result.text.toLowerCase()).toContain("already");
	});

	test("deletes an empty folder", async () => {
		await ensure(["Scratch"]);

		expect(
			(await call("quiz_delete_folder", { path: ["Scratch"] })).isError,
		).toBe(false);
		expect((await call("quiz_list_folders")).text).toContain("No folders yet");
	});

	test("refuses to delete a folder that still holds something", async () => {
		await publishedSetIn(path);

		const result = await call("quiz_delete_folder", { path });

		expect(result.isError).toBe(true);
		expect(result.text).toContain("1 set");
	});

	test("shows what blocks a delete instead of reporting an empty folder", async () => {
		const created = await call("quiz_create_set", {
			title: "Draft only",
			language: "en",
			folderPath: ["Scratch"],
		});

		const tree = await call("quiz_list_folders");

		expect(tree.text).toContain("Scratch (0 sets, 1 unpublished)");

		const refusal = await call("quiz_delete_folder", { path: ["Scratch"] });

		expect(refusal.isError).toBe(true);
		expect(refusal.text).toContain("1 set");
		expect(String(created.structured.quizSetId).length).toBeGreaterThan(0);
	});

	test("does not create the folder path when the set id is unknown", async () => {
		const result = await call("quiz_move_set", {
			quizSetId: "does-not-exist",
			folderPath: ["Programming", "SQL"],
		});

		expect(result.isError).toBe(true);
		expect((await call("quiz_list_folders")).text).toContain("No folders yet");
	});

	test("resolves an existing path regardless of case", async () => {
		await ensure(["Programming", "SQL"]);

		const deleted = await call("quiz_delete_folder", {
			path: ["PROGRAMMING", "sql"],
		});

		expect(deleted.isError).toBe(false);
	});

	test("refuses an unknown path with a readable message", async () => {
		const result = await call("quiz_delete_folder", { path: ["Nope"] });

		expect(result.isError).toBe(true);
		expect(result.text).toContain("Nope");
	});

	test("refuses a segment longer than the name limit", async () => {
		const result = await ensure(["x".repeat(61)]);

		expect(result.isError).toBe(true);
	});

	test("refuses a path deeper than the depth limit", async () => {
		const result = await ensure(["a", "b", "c", "d", "e", "f", "g"]);

		expect(result.isError).toBe(true);
		expect(result.text.toLowerCase()).toContain("deep");
	});
});

describe("authoring typed questions", () => {
	test("takes accepted answers instead of options", async () => {
		const quizSetId = await newDraft("Vocabulary");

		const added = await call("quiz_add_questions", {
			quizSetId,
			questions: [
				{
					type: "typed_answer",
					prompt: "кіт",
					difficulty: "easy",
					acceptedAnswers: ["cat"],
				},
			],
		});

		expect(added.isError).toBe(false);

		const read = await call("quiz_get_set", { quizSetId });

		expect(read.text).toContain("typed_answer");
		expect(read.text).toContain("* cat");
	});

	test("accepts several spellings", async () => {
		const quizSetId = await newDraft("Vocabulary");

		await call("quiz_add_questions", {
			quizSetId,
			questions: [
				{
					type: "typed_answer",
					prompt: "колір",
					difficulty: "easy",
					acceptedAnswers: ["colour", "color"],
				},
			],
		});

		const read = await call("quiz_get_set", { quizSetId });

		expect(read.text).toContain("* colour");
		expect(read.text).toContain("* color");
	});

	test("refuses a typed question with no accepted answers", async () => {
		const quizSetId = await newDraft("Vocabulary");

		const added = await call("quiz_add_questions", {
			quizSetId,
			questions: [{ type: "typed_answer", prompt: "кіт", difficulty: "easy" }],
		});

		expect(added.isError).toBe(true);
	});

	test("refuses a cloze prompt with no blank", async () => {
		const quizSetId = await newDraft("Grammar");

		const added = await call("quiz_add_questions", {
			quizSetId,
			questions: [
				{
					type: "cloze",
					prompt: "She has lived here since 2019.",
					difficulty: "medium",
					acceptedAnswers: ["since"],
				},
			],
		});

		expect(added.isError).toBe(true);
	});

	test("still refuses a single choice with no options", async () => {
		const quizSetId = await newDraft("Vocabulary");

		const added = await call("quiz_add_questions", {
			quizSetId,
			questions: [
				{ type: "single_choice", prompt: "Pick one", difficulty: "easy" },
			],
		});

		expect(added.isError).toBe(true);
	});
});

describe("matching authoring", () => {
	test("stores pairs as lefts then rights sharing a key", async () => {
		const quizSetId = await newDraft("Pairs");

		const added = await call("quiz_add_questions", {
			quizSetId,
			questions: [
				{
					type: "matching",
					prompt: "Match",
					difficulty: "easy",
					pairs: [
						{ left: "cat", right: "кіт" },
						{ left: "dog", right: "пес" },
					],
				},
			],
		});

		expect(added.isError).toBe(false);

		const read = await call("quiz_get_set", { quizSetId });

		expect(read.text).toContain("matching");
		expect(read.text).toContain("cat");
		expect(read.text).toContain("кіт");
	});

	test("refuses more pairs than a callback payload can carry", async () => {
		const quizSetId = await newDraft("Pairs");

		const added = await call("quiz_add_questions", {
			quizSetId,
			questions: [
				{
					type: "matching",
					prompt: "Match",
					difficulty: "easy",
					pairs: Array.from({ length: 10 }, (_value, index) => ({
						left: `l${index}`,
						right: `r${index}`,
					})),
				},
			],
		});

		expect(added.isError).toBe(true);
	});
});

describe("vocabulary authoring", () => {
	const addPairs = async (
		quizSetId: string,
		pairs: unknown[],
		extra: Record<string, unknown> = {},
	) => call("quiz_add_vocabulary", { quizSetId, pairs, ...extra });

	test("one pair becomes both directions", async () => {
		const quizSetId = await newDraft("A1");

		const added = await addPairs(quizSetId, [
			{ term: "cat", translation: "кіт" },
		]);

		expect(added.isError).toBe(false);
		expect(added.structured.addedQuestionCount).toBe(2);

		const read = await call("quiz_get_set", { quizSetId });

		expect(read.text).toContain("cat");
		expect(read.text).toContain("кіт");
	});

	test("accepts every variant on either side", async () => {
		const quizSetId = await newDraft("A1");

		await addPairs(quizSetId, [
			{ term: ["colour", "color"], translation: "колір" },
		]);

		const read = await call("quiz_get_set", { quizSetId });

		expect(read.text).toContain("* colour");
		expect(read.text).toContain("* color");
	});

	test("makes only the asked-for direction", async () => {
		const quizSetId = await newDraft("A1");

		const added = await addPairs(
			quizSetId,
			[{ term: "cat", translation: "кіт" }],
			{ direction: "translation_to_term" },
		);

		expect(added.structured.addedQuestionCount).toBe(1);
	});

	test("re-sending the same pairs is a no-op", async () => {
		const quizSetId = await newDraft("A1");
		const pairs = [{ term: "cat", translation: "кіт" }];

		await addPairs(quizSetId, pairs);
		const again = await addPairs(quizSetId, pairs);

		expect(again.text).toContain("No change");
	});

	test("carries the transcription as a hint on the harder direction", async () => {
		const quizSetId = await newDraft("A1");

		await addPairs(quizSetId, [
			{ term: "cat", translation: "кіт", transcription: "/kæt/" },
		]);

		const read = await call("quiz_get_set", { quizSetId });

		expect(read.text).toContain("cat");
	});

	test("refuses an empty pair", async () => {
		const quizSetId = await newDraft("A1");

		expect(
			(await addPairs(quizSetId, [{ term: "", translation: "кіт" }])).isError,
		).toBe(true);
	});
});

describe("repetition settings", () => {
	test("reports the built-in defaults", async () => {
		const result = await call("quiz_get_repetition_settings");

		expect(result.isError).toBe(false);
		expect(result.structured.intervalsDays).toEqual([1, 3, 7, 14, 30]);
	});

	test("changes the global settings", async () => {
		await call("quiz_set_repetition_settings", {
			intervalsDays: [1, 7],
			maxIntervalDays: 7,
			maxRepetitions: 5,
		});

		expect(
			(await call("quiz_get_repetition_settings")).structured.maxIntervalDays,
		).toBe(7);
	});

	test("a per-set setting wins over the global one", async () => {
		const quizSetId = await newDraft("Set");

		await call("quiz_set_repetition_settings", {
			intervalsDays: [1, 7],
			maxIntervalDays: 7,
			maxRepetitions: 5,
		});
		await call("quiz_set_repetition_settings", {
			quizSetId,
			intervalsDays: [1, 30],
			maxIntervalDays: 30,
			maxRepetitions: 3,
		});

		expect(
			(await call("quiz_get_repetition_settings", { quizSetId })).structured
				.maxIntervalDays,
		).toBe(30);
	});

	test("says where the settings came from", async () => {
		expect((await call("quiz_get_repetition_settings")).structured.source).toBe(
			"default",
		);

		await call("quiz_set_repetition_settings", {
			intervalsDays: [1, 7],
			maxIntervalDays: 7,
			maxRepetitions: 5,
		});

		expect((await call("quiz_get_repetition_settings")).structured.source).toBe(
			"global",
		);

		const quizSetId = await newDraft("Pinned");

		expect(
			(await call("quiz_get_repetition_settings", { quizSetId })).structured
				.source,
		).toBe("global");

		await call("quiz_set_repetition_settings", {
			quizSetId,
			intervalsDays: [1, 30],
			maxIntervalDays: 30,
			maxRepetitions: 3,
		});

		expect(
			(await call("quiz_get_repetition_settings", { quizSetId })).structured
				.source,
		).toBe("set");
	});

	test("refuses a set that does not exist", async () => {
		expect(
			(await call("quiz_get_repetition_settings", { quizSetId: "ghost" }))
				.isError,
		).toBe(true);
		expect(
			(
				await call("quiz_set_repetition_settings", {
					quizSetId: "ghost",
					intervalsDays: [1],
					maxIntervalDays: 1,
					maxRepetitions: 1,
				})
			).isError,
		).toBe(true);
	});

	test("reports the waits the ceiling actually allows", async () => {
		const result = await call("quiz_set_repetition_settings", {
			intervalsDays: [30, 60, 90],
			maxIntervalDays: 1,
			maxRepetitions: 5,
		});

		expect(result.text).toContain("waits: 1, 1, 1");
	});

	test("refuses an impossible schedule", async () => {
		const result = await call("quiz_set_repetition_settings", {
			intervalsDays: [0],
			maxIntervalDays: 7,
			maxRepetitions: 5,
		});

		expect(result.isError).toBe(true);
	});
});

describe("correcting a vocabulary item", () => {
	test("rebuilds both directions and keeps the question ids", async () => {
		const quizSetId = await newDraft("A1");
		const added = await call("quiz_add_vocabulary", {
			quizSetId,
			pairs: [{ term: "cat", translation: "кыт" }],
		});
		const itemId = (added.structured.itemIds as string[])[0];

		const before = await call("quiz_get_set", { quizSetId });

		expect(before.text).toContain("кыт");

		const fixed = await call("quiz_update_vocabulary", {
			itemId,
			translation: "кіт",
		});

		expect(fixed.isError).toBe(false);
		expect(fixed.structured.rebuiltQuestionCount).toBe(2);

		const after = await call("quiz_get_set", { quizSetId });

		expect(after.text).not.toContain("кыт");
		expect(after.text).toContain("кіт");
	});

	test("refuses an item that does not exist", async () => {
		expect(
			(await call("quiz_update_vocabulary", { itemId: "ghost", term: "cat" }))
				.isError,
		).toBe(true);
	});
});
