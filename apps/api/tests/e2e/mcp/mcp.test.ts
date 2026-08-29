import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
	createMemoryApplication,
	type MemoryApplication,
} from "@tests/fixtures/application.fixture";
import {
	createSequentialIdGenerator,
	sequentialId,
} from "@tests/fixtures/memory.fixture";
import { createMcpServer, MCP_SERVER_NAME } from "@/adapters/mcp/server";
import { QuestionType } from "@/domain/quiz-set/question";

let application: MemoryApplication;
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
	application = createMemoryApplication({
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
	await application.close();
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
			"quiz_append_summary",
			"quiz_archive_set",
			"quiz_attach_set",
			"quiz_create_set",
			"quiz_delete_folder",
			"quiz_delete_question",
			"quiz_detach_set",
			"quiz_ensure_folder_path",
			"quiz_get_set",
			"quiz_get_settings",
			"quiz_list_folders",
			"quiz_list_sets",
			"quiz_list_vocabulary",
			"quiz_move_set",
			"quiz_publish_set",
			"quiz_read_summary",
			"quiz_rename_folder",
			"quiz_set_settings",
			"quiz_summary_history",
			"quiz_update_question",
			"quiz_update_set",
			"quiz_update_vocabulary",
			"quiz_write_summary",
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
		expect(String(result.structured.quizSetId)).toBe(sequentialId("q", 1));
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

		expect(result.text).toContain("quiz_publish_set");
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

	test("a published set still takes edits and new questions", async () => {
		const quizSetId = await newDraft();
		await call("quiz_add_questions", {
			quizSetId,
			questions: [aQuestion("One")],
		});
		await call("quiz_publish_set", { quizSetId });

		const renamed = await call("quiz_update_set", { quizSetId, title: "New" });
		const grown = await call("quiz_add_questions", {
			quizSetId,
			questions: [aQuestion("Two")],
		});

		expect(renamed.isError).toBeFalsy();
		expect(grown.isError).toBeFalsy();

		const reread = await call("quiz_get_set", { quizSetId });

		expect(reread.text).toContain("New");
		expect(reread.text).toContain("Two");
	});

	test("editing an archived set is refused with a reason", async () => {
		const quizSetId = await newDraft();
		await call("quiz_add_questions", {
			quizSetId,
			questions: [aQuestion("One")],
		});
		await call("quiz_archive_set", { quizSetId });

		const result = await call("quiz_update_set", { quizSetId, title: "New" });

		expect(result.isError).toBe(true);
		expect(result.text).toContain("read-only");
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

	test("writes a summary onto a page it creates on the way", async () => {
		const written = await call("quiz_write_summary", {
			path: ["Biology", "Chapter 1"],
			summary: "# Cells\n\nEvery living thing is made of them.",
		});

		expect(written.isError).toBe(false);
		expect(written.structured.length).toBe(44);

		const read = await call("quiz_read_summary", {
			path: ["Biology", "Chapter 1"],
		});

		expect(read.text).toContain("Every living thing is made of them.");
		expect(read.structured.name).toBe("Chapter 1");
	});

	test("replaces a summary and can clear it", async () => {
		await call("quiz_write_summary", { path: ["Physics"], summary: "first" });
		await call("quiz_write_summary", { path: ["Physics"], summary: "second" });

		expect((await call("quiz_read_summary", { path: ["Physics"] })).text).toBe(
			"second",
		);

		await call("quiz_write_summary", { path: ["Physics"], summary: "" });

		const cleared = await call("quiz_read_summary", { path: ["Physics"] });

		expect(cleared.structured.summary).toBeUndefined();
		expect(cleared.text).toContain("no summary yet");
	});

	test("reads the pages and quizzes filed under a page", async () => {
		await call("quiz_write_summary", {
			path: ["Chemistry"],
			summary: "Matter and its changes.",
		});
		await ensure(["Chemistry", "Bonds"]);
		await publishedSetIn(["Chemistry"], "Periodic table");

		const read = await call("quiz_read_summary", { path: ["Chemistry"] });

		expect(read.structured.pages).toEqual(["Bonds"]);
		expect(read.structured.quizzes).toEqual([
			{
				id: expect.any(String),
				title: "Periodic table",
				questionCount: 1,
			},
		]);
	});

	test("shows a quiz under a page it is not filed in", async () => {
		const quizSetId = await publishedSetIn(["Books", "JS basics"], "JS words");

		await call("quiz_write_summary", {
			path: ["Programming", "JS", "Chapter 1"],
			summary: "Scopes and closures.",
		});

		const attached = await call("quiz_attach_set", {
			path: ["Programming", "JS", "Chapter 1"],
			quizSetId,
		});

		expect(attached.isError).toBe(false);

		const read = await call("quiz_read_summary", {
			path: ["Programming", "JS", "Chapter 1"],
		});

		expect(read.structured.attached).toEqual([
			{ id: quizSetId, title: "JS words", questionCount: 1 },
		]);
		expect(read.structured.quizzes).toEqual([]);

		const filed = await call("quiz_read_summary", {
			path: ["Books", "JS basics"],
		});

		expect(filed.structured.quizzes).toEqual([
			{ id: quizSetId, title: "JS words", questionCount: 1 },
		]);
	});

	test("stops showing a quiz without moving or deleting it", async () => {
		const quizSetId = await publishedSetIn(["Books"], "JS words");

		await call("quiz_attach_set", { path: ["Notes"], quizSetId });
		const detached = await call("quiz_detach_set", {
			path: ["Notes"],
			quizSetId,
		});

		expect(detached.isError).toBe(false);
		expect(
			(await call("quiz_read_summary", { path: ["Notes"] })).structured
				.attached,
		).toEqual([]);
		expect(
			(await call("quiz_read_summary", { path: ["Books"] })).structured.quizzes,
		).toEqual([{ id: quizSetId, title: "JS words", questionCount: 1 }]);
	});

	test("refuses to show a quiz that does not exist", async () => {
		const result = await call("quiz_attach_set", {
			path: ["Notes"],
			quizSetId: "missing",
		});

		expect(result.isError).toBe(true);
	});

	test("appends section by section without resending what is there", async () => {
		await call("quiz_append_summary", {
			path: ["DDIA", "Chapter 5"],
			summary: "## Leaders and followers",
		});
		await call("quiz_append_summary", {
			path: ["DDIA", "Chapter 5"],
			summary: "## Multi-leader replication",
		});

		expect(
			(await call("quiz_read_summary", { path: ["DDIA", "Chapter 5"] })).text,
		).toBe("## Leaders and followers\n\n## Multi-leader replication");
	});

	test("keeps what an overwrite replaced", async () => {
		await call("quiz_write_summary", { path: ["DDIA"], summary: "first" });
		await call("quiz_write_summary", { path: ["DDIA"], summary: "second" });

		const history = await call("quiz_summary_history", { path: ["DDIA"] });
		const revisions = history.structured.revisions as {
			summary?: string;
			authorKind: string;
		}[];

		expect(revisions.map((revision) => revision.summary)).toEqual(["first"]);
		expect(revisions[0]?.authorKind).toBe("mcp");
	});

	test("records nothing for a page written for the first time", async () => {
		await call("quiz_write_summary", { path: ["Fresh"], summary: "first" });

		const history = await call("quiz_summary_history", { path: ["Fresh"] });

		expect(history.structured.revisions).toEqual([]);
		expect(history.text).toContain("never been rewritten");
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

describe("editing one question (§4.5)", () => {
	const seededSet = async (): Promise<{ setId: string; ids: string[] }> => {
		const setId = await newDraft("Editable");

		await call("quiz_add_questions", {
			quizSetId: setId,
			questions: [
				aQuestion("Keep me"),
				{
					type: "typed_answer",
					prompt: "zip",
					difficulty: "easy",
					acceptedAnswers: ["блискавка"],
				},
			],
		});

		const read = await call("quiz_get_set", { quizSetId: setId });
		const ids = (read.structured.questions as { id: string }[]).map(
			(question) => question.id,
		);

		return { setId, ids };
	};

	test("adds a synonym to a typed answer", async () => {
		const { setId, ids } = await seededSet();

		const result = await call("quiz_update_question", {
			quizSetId: setId,
			questionId: ids[1],
			acceptedAnswers: ["блискавка", "змійка", "повзунок"],
		});

		expect(result.isError).toBe(false);
		expect(result.structured.optionCount).toBe(3);
	});

	test("keeps the question id, so history would survive", async () => {
		const { setId, ids } = await seededSet();

		const result = await call("quiz_update_question", {
			quizSetId: setId,
			questionId: ids[1],
			prompt: "zip (clothing)",
		});

		expect(result.structured.questionId).toBe(ids[1]);
	});

	test("refuses answers the type does not allow", async () => {
		const { setId, ids } = await seededSet();

		const result = await call("quiz_update_question", {
			quizSetId: setId,
			questionId: ids[0],
			acceptedAnswers: ["one", "two"],
		});

		expect(result.isError).toBe(true);
	});

	test("refuses a question that is not there", async () => {
		const { setId } = await seededSet();

		expect(
			(
				await call("quiz_update_question", {
					quizSetId: setId,
					questionId: "ghost",
					prompt: "Nope",
				})
			).isError,
		).toBe(true);
	});

	test("removes a question nobody answered", async () => {
		const { setId, ids } = await seededSet();

		const result = await call("quiz_delete_question", {
			quizSetId: setId,
			questionId: ids[1],
		});

		expect(result.isError).toBe(false);
		expect(result.structured.remaining).toBe(1);
	});

	test("refuses to empty a set", async () => {
		const { setId, ids } = await seededSet();

		await call("quiz_delete_question", {
			quizSetId: setId,
			questionId: ids[1],
		});

		expect(
			(
				await call("quiz_delete_question", {
					quizSetId: setId,
					questionId: ids[0],
				})
			).isError,
		).toBe(true);
	});
});

describe("quiz settings", () => {
	test("reports the built-in defaults", async () => {
		const result = await call("quiz_get_settings");

		expect(result.isError).toBe(false);
		expect(result.structured.intervalsDays).toEqual([1, 3, 7, 14, 30]);
	});

	test("changes the global settings", async () => {
		await call("quiz_set_settings", {
			intervalsDays: [1, 7],
			maxIntervalDays: 7,
			maxRepetitions: 5,
		});

		expect((await call("quiz_get_settings")).structured.maxIntervalDays).toBe(
			7,
		);
	});

	test("a per-set setting wins over the global one", async () => {
		const quizSetId = await newDraft("Set");

		await call("quiz_set_settings", {
			intervalsDays: [1, 7],
			maxIntervalDays: 7,
			maxRepetitions: 5,
		});
		await call("quiz_set_settings", {
			quizSetId,
			intervalsDays: [1, 30],
			maxIntervalDays: 30,
			maxRepetitions: 3,
		});

		expect(
			(await call("quiz_get_settings", { quizSetId })).structured
				.maxIntervalDays,
		).toBe(30);
	});

	test("says where the settings came from", async () => {
		expect((await call("quiz_get_settings")).structured.source).toBe("default");

		await call("quiz_set_settings", {
			intervalsDays: [1, 7],
			maxIntervalDays: 7,
			maxRepetitions: 5,
		});

		expect((await call("quiz_get_settings")).structured.source).toBe("global");

		const quizSetId = await newDraft("Pinned");

		expect(
			(await call("quiz_get_settings", { quizSetId })).structured.source,
		).toBe("global");

		await call("quiz_set_settings", {
			quizSetId,
			intervalsDays: [1, 30],
			maxIntervalDays: 30,
			maxRepetitions: 3,
		});

		expect(
			(await call("quiz_get_settings", { quizSetId })).structured.source,
		).toBe("set");
	});

	test("reports both shuffles as off by default", async () => {
		const result = await call("quiz_get_settings");

		expect(result.structured.shuffleOptions).toBe(false);
		expect(result.structured.shuffleQuestions).toBe(false);
		expect(result.text).toContain("questions are asked");
	});

	test("turns question shuffling on without touching the option order", async () => {
		await call("quiz_set_settings", { shuffleQuestions: true });

		const result = await call("quiz_get_settings");

		expect(result.structured.shuffleQuestions).toBe(true);
		expect(result.structured.shuffleOptions).toBe(false);
	});

	test("pins question shuffling to a single set", async () => {
		const quizSetId = await newDraft("Pinned");

		await call("quiz_set_settings", { quizSetId, shuffleQuestions: true });

		expect(
			(await call("quiz_get_settings", { quizSetId })).structured
				.shuffleQuestions,
		).toBe(true);
		expect((await call("quiz_get_settings")).structured.shuffleQuestions).toBe(
			false,
		);
	});

	test("leaves the question shuffle alone when other fields change", async () => {
		await call("quiz_set_settings", { shuffleQuestions: true });
		await call("quiz_set_settings", { maxRepetitions: 4 });

		expect((await call("quiz_get_settings")).structured.shuffleQuestions).toBe(
			true,
		);
	});

	test("reports the exam mode as off by default", async () => {
		const result = await call("quiz_get_settings");

		expect(result.structured.examMode).toBe(false);
		expect(result.text).toContain("verdicts");
	});

	test("turns the exam mode on for one set only", async () => {
		const quizSetId = await newDraft("Exam");

		await call("quiz_set_settings", { quizSetId, examMode: true });

		expect(
			(await call("quiz_get_settings", { quizSetId })).structured.examMode,
		).toBe(true);
		expect((await call("quiz_get_settings")).structured.examMode).toBe(false);
	});

	test("leaves the exam mode alone when other fields change", async () => {
		await call("quiz_set_settings", { examMode: true });
		await call("quiz_set_settings", { shuffleOptions: true });

		expect((await call("quiz_get_settings")).structured.examMode).toBe(true);
	});

	test("refuses a set that does not exist", async () => {
		expect(
			(await call("quiz_get_settings", { quizSetId: "ghost" })).isError,
		).toBe(true);
		expect(
			(
				await call("quiz_set_settings", {
					quizSetId: "ghost",
					intervalsDays: [1],
					maxIntervalDays: 1,
					maxRepetitions: 1,
				})
			).isError,
		).toBe(true);
	});

	test("reports the waits the ceiling actually allows", async () => {
		const result = await call("quiz_set_settings", {
			intervalsDays: [30, 60, 90],
			maxIntervalDays: 1,
			maxRepetitions: 5,
		});

		expect(result.text).toContain("waits: 1, 1, 1");
	});

	test("refuses an impossible schedule", async () => {
		const result = await call("quiz_set_settings", {
			intervalsDays: [0],
			maxIntervalDays: 7,
			maxRepetitions: 5,
		});

		expect(result.isError).toBe(true);
	});
});

describe("correcting a vocabulary item", () => {
	test("rebuilds both directions while the question ids stay put", async () => {
		const quizSetId = await newDraft("A1");

		await call("quiz_add_vocabulary", {
			quizSetId,
			pairs: [{ term: "cat", translation: "кыт" }],
		});

		const listed = await call("quiz_list_vocabulary", { quizSetId });
		const item = (
			listed.structured.items as { itemId: string; questionIds: string[] }[]
		)[0];

		if (item === undefined) throw new Error("nothing was listed");

		expect(listed.text).toContain("кыт");

		const fixed = await call("quiz_update_vocabulary", {
			itemId: item.itemId,
			translation: "кіт",
		});

		expect(fixed.isError).toBe(false);
		expect(fixed.structured.rebuiltQuestionCount).toBe(2);

		const after = await call("quiz_list_vocabulary", { quizSetId });
		const rebuilt = (after.structured.items as { questionIds: string[] }[])[0];

		expect(rebuilt?.questionIds).toEqual(item.questionIds);
		expect(after.text).toContain("кіт");
		expect(after.text).not.toContain("кыт");
	});

	test("tells the caller how to find a real id", async () => {
		const result = await call("quiz_update_vocabulary", {
			itemId: "ghost",
			term: "cat",
		});

		expect(result.isError).toBe(true);
		expect(result.text).toContain("quiz_list_vocabulary");
	});

	test("explains an invalid correction instead of dumping the error", async () => {
		const quizSetId = await newDraft("A1");

		await call("quiz_add_vocabulary", {
			quizSetId,
			pairs: [{ term: "cat", translation: "кіт" }],
		});

		const listed = await call("quiz_list_vocabulary", { quizSetId });
		const item = (listed.structured.items as { itemId: string }[])[0];

		if (item === undefined) throw new Error("nothing was listed");

		const result = await call("quiz_update_vocabulary", {
			itemId: item.itemId,
			term: ["cat", "cat"],
		});

		expect(result.isError).toBe(true);
		expect(result.text).toContain("Invalid vocabulary item");
		expect(result.text).not.toContain("Unexpected error");
	});
});
