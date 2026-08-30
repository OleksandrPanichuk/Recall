import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import {
	DuplicateFolderNameError,
	FolderCycleError,
	FolderDepthError,
} from "@/domain/folder/folder.errors";
import { createFoldersHarness, type FoldersHarness } from "./folders.fixture";
import type { MoveFolderUseCase } from "./move-folder";

let context: MemoryContext;
let moveFolder: MoveFolderUseCase;
let create: FoldersHarness["create"];
let chain: FoldersHarness["chain"];

beforeEach(() => {
	({ context, moveFolder, create, chain } = createFoldersHarness());
});

afterEach(() => {
	context.close();
});

describe("MoveFolderUseCase", () => {
	test("moves a folder to another parent", async () => {
		const programming = await create("Programming");
		const english = await create("English");
		const id = await create("Basics", programming);

		await moveFolder.execute({ folderId: id, parentId: english });

		expect((await context.scope.pages.findById(id))?.parentId).toBe(english);
		expect(await context.scope.pages.listChildren(programming)).toHaveLength(0);
	});

	test("moves a folder to the root", async () => {
		const programming = await create("Programming");
		const id = await create("SQL", programming);

		await moveFolder.execute({ folderId: id, parentId: undefined });

		expect((await context.scope.pages.findById(id))?.parentId).toBeUndefined();
	});

	test("rejects moving a folder under its own descendant", async () => {
		const parentId = await create("English");
		const childId = await create("Vocabulary", parentId);

		expect(
			moveFolder.execute({ folderId: parentId, parentId: childId }),
		).rejects.toBeInstanceOf(FolderCycleError);
	});

	test("rejects moving a folder into itself", async () => {
		const id = await create("English");

		expect(
			moveFolder.execute({ folderId: id, parentId: id }),
		).rejects.toBeInstanceOf(FolderCycleError);
	});

	test("rejects a move that collides with a name at the destination", async () => {
		const english = await create("English");
		await create("Basics", english);
		const id = await create("Basics");

		expect(
			moveFolder.execute({ folderId: id, parentId: english }),
		).rejects.toBeInstanceOf(DuplicateFolderNameError);
	});

	test("rejects a move that pushes the moved subtree past the depth limit", async () => {
		const subtreeRoot = await create("Subtree");
		const middle = await create("Middle", subtreeRoot);
		await create("Leaf", middle);

		const destination = await chain("d1", "d2", "d3", "d4");

		expect(
			moveFolder.execute({ folderId: subtreeRoot, parentId: destination }),
		).rejects.toBeInstanceOf(FolderDepthError);
	});

	test("allows a move that keeps the subtree inside the depth limit", async () => {
		const subtreeRoot = await create("Subtree");
		const middle = await create("Middle", subtreeRoot);
		await create("Leaf", middle);

		const destination = await chain("d1", "d2", "d3");

		await moveFolder.execute({ folderId: subtreeRoot, parentId: destination });

		expect((await context.scope.pages.findById(subtreeRoot))?.parentId).toBe(
			destination,
		);
	});
});
