import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import { aQuestion, aQuizSet } from "@tests/fixtures/quiz-set.fixture";
import type { ListPageTreeUseCase } from "./list-page-tree";
import { createPagesHarness, type PagesHarness } from "./pages.fixture";

let context: MemoryContext;
let listPageTree: ListPageTreeUseCase;
let create: PagesHarness["create"];

beforeEach(() => {
	({ context, listPageTree, create } = createPagesHarness());
});

afterEach(() => {
	context.close();
});

describe("ListPageTreeUseCase", () => {
	test("walks depth-first, in the order the owner put them, with each depth", async () => {
		const english = await create("English");
		const vocabulary = await create("Vocabulary", english);
		await create("By levels", vocabulary);
		await create("Grammar", english);
		await create("Programming");

		expect(
			(await listPageTree.execute()).map((node) => [node.name, node.depth]),
		).toEqual([
			["English", 0],
			["Vocabulary", 1],
			["By levels", 2],
			["Grammar", 1],
			["Programming", 0],
		]);
	});

	test("separates published from unpublished counts", async () => {
		const folderId = await create("English");
		const draft = aQuizSet({
			id: "set-1",
			questions: [aQuestion({ id: "q1" })],
		});

		await context.unitOfWork.run(({ quizzes }) =>
			quizzes.save({ ...draft, folderId }),
		);

		const [node] = await listPageTree.execute();

		expect(node?.setCount).toBe(0);
		expect(node?.unpublishedCount).toBe(1);
	});

	test("is empty for an empty library", async () => {
		expect(await listPageTree.execute()).toEqual([]);
	});
});
