import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import {
	createPagesHarness,
	type PagesHarness,
} from "@tests/fixtures/pages.use-cases";
import { aQuestion, aQuizSet } from "@tests/fixtures/quiz-set.fixture";
import { type PageId } from "@/modules/pages";
import { FolderNotEmptyError, FolderNotFoundError } from "../pages.errors";
import type { DeletePageUseCase } from "./delete-page";

let context: MemoryContext;
let deletePage: DeletePageUseCase;
let create: PagesHarness["create"];

beforeEach(() => {
	({ context, deletePage, create } = createPagesHarness());
});

afterEach(() => {
	context.close();
});

describe("DeletePageUseCase", () => {
	test("deletes an empty folder", async () => {
		const id = await create("Scratch");

		await deletePage.execute({ folderId: id });

		expect(await context.scope.pages.findById(id)).toBeUndefined();
	});

	test("refuses a folder that still has a child", async () => {
		const parentId = await create("English");
		await create("Vocabulary", parentId);

		expect(deletePage.execute({ folderId: parentId })).rejects.toBeInstanceOf(
			FolderNotEmptyError,
		);
	});

	test("refuses a folder that still holds a set", async () => {
		const folderId = await create("English");
		const draft = aQuizSet({
			id: "set-1",
			questions: [aQuestion({ id: "q1" })],
		});

		await context.unitOfWork.run(({ quizzes }) =>
			quizzes.save({ ...draft, folderId }),
		);

		await expect(deletePage.execute({ folderId })).rejects.toBeInstanceOf(
			FolderNotEmptyError,
		);
	});

	test("rejects an unknown folder", async () => {
		expect(
			deletePage.execute({ folderId: "missing" as PageId }),
		).rejects.toBeInstanceOf(FolderNotFoundError);
	});
});
