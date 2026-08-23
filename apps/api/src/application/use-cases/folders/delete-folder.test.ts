import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import { aQuestion, aQuizSet } from "@tests/fixtures/quiz-set.fixture";
import type { FolderId } from "@/domain/folder/folder";
import { FolderNotFoundError } from "./create-folder";
import { type DeleteFolderUseCase, FolderNotEmptyError } from "./delete-folder";
import { createFoldersHarness, type FoldersHarness } from "./folders.fixture";

let context: MemoryContext;
let deleteFolder: DeleteFolderUseCase;
let create: FoldersHarness["create"];

beforeEach(() => {
	({ context, deleteFolder, create } = createFoldersHarness());
});

afterEach(() => {
	context.close();
});

describe("DeleteFolderUseCase", () => {
	test("deletes an empty folder", async () => {
		const id = await create("Scratch");

		await deleteFolder.execute({ folderId: id });

		expect(await context.scope.pages.findById(id)).toBeUndefined();
	});

	test("refuses a folder that still has a child", async () => {
		const parentId = await create("English");
		await create("Vocabulary", parentId);

		expect(deleteFolder.execute({ folderId: parentId })).rejects.toBeInstanceOf(
			FolderNotEmptyError,
		);
	});

	test("refuses a folder that still holds a set", async () => {
		const folderId = await create("English");
		const draft = aQuizSet({
			id: "set-1",
			questions: [aQuestion({ id: "q1" })],
		});

		context.quizSets.save({ ...draft, folderId });

		expect(deleteFolder.execute({ folderId })).rejects.toBeInstanceOf(
			FolderNotEmptyError,
		);
	});

	test("rejects an unknown folder", async () => {
		expect(
			deleteFolder.execute({ folderId: "missing" as FolderId }),
		).rejects.toBeInstanceOf(FolderNotFoundError);
	});
});
