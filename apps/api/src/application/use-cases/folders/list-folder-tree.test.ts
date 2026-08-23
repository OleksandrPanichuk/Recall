import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { TestContext } from "@tests/fixtures/application.fixture";
import { aQuestion, aQuizSet } from "@tests/fixtures/quiz-set.fixture";
import { createFoldersHarness, type FoldersHarness } from "./folders.fixture";
import type { ListFolderTree } from "./list-folder-tree";

let context: TestContext;
let listFolderTree: ListFolderTree;
let create: FoldersHarness["create"];

beforeEach(() => {
	({ context, listFolderTree, create } = createFoldersHarness());
});

afterEach(() => {
	context.close();
});

describe("ListFolderTree", () => {
	test("walks depth-first, name-ordered, with the depth of each node", async () => {
		const english = await create("English");
		const vocabulary = await create("Vocabulary", english);
		await create("By levels", vocabulary);
		await create("Grammar", english);
		await create("Programming");

		expect(
			(await listFolderTree.execute({})).map((node) => [node.name, node.depth]),
		).toEqual([
			["English", 0],
			["Grammar", 1],
			["Vocabulary", 1],
			["By levels", 2],
			["Programming", 0],
		]);
	});

	test("separates published from unpublished counts", async () => {
		const folderId = await create("English");
		const draft = aQuizSet({
			id: "set-1",
			questions: [aQuestion({ id: "q1" })],
		});

		context.quizSets.save({ ...draft, folderId });

		const [node] = await listFolderTree.execute({});

		expect(node?.setCount).toBe(0);
		expect(node?.unpublishedCount).toBe(1);
	});

	test("is empty for an empty library", async () => {
		expect(await listFolderTree.execute({})).toEqual([]);
	});
});
