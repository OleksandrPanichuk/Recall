import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { FolderId } from "@/domain/folder/folder";
import {
	DuplicateFolderNameError,
	FolderCycleError,
	FolderDepthError,
} from "@/domain/folder/folder.errors";
import {
	createTestContext,
	type TestContext,
} from "../../../../tests/fixtures/application.fixture";
import { CreateFolder, FolderNotFoundError } from "./create-folder";
import { DeleteFolder, FolderNotEmptyError } from "./delete-folder";
import { EnsureFolderPath } from "./ensure-folder-path";
import { MoveFolder } from "./move-folder";
import { RenameFolder } from "./rename-folder";

let context: TestContext;
let createFolder: CreateFolder;
let renameFolder: RenameFolder;
let moveFolder: MoveFolder;
let deleteFolder: DeleteFolder;
let ensureFolderPath: EnsureFolderPath;

beforeEach(() => {
	context = createTestContext();

	const dependencies = {
		folders: context.folders,
		clock: context.clock,
		idGenerator: context.idGenerator,
		transaction: context.transaction,
	};

	createFolder = new CreateFolder(dependencies);
	renameFolder = new RenameFolder(dependencies);
	moveFolder = new MoveFolder(dependencies);
	deleteFolder = new DeleteFolder(dependencies);
	ensureFolderPath = new EnsureFolderPath(dependencies);
});

afterEach(() => {
	context.close();
});

const create = async (name: string, parentId?: FolderId): Promise<FolderId> =>
	(await createFolder.execute({ name, parentId })).folderId;

const chain = async (...names: readonly string[]): Promise<FolderId> => {
	let parentId: FolderId | undefined;

	for (const name of names) {
		parentId = await create(name, parentId);
	}

	if (parentId === undefined) {
		throw new Error("chain needs at least one name");
	}

	return parentId;
};

const nameOf = (id: FolderId): string | undefined =>
	context.folders.findById(id)?.name;

describe("CreateFolder", () => {
	test("creates a root folder", async () => {
		const id = await create("Programming");

		expect(nameOf(id)).toBe("Programming");
		expect(context.folders.findById(id)?.parentId).toBeUndefined();
	});

	test("creates a child under a parent", async () => {
		const parentId = await create("Programming");
		const id = await create("SQL", parentId);

		expect(context.folders.findById(id)?.parentId).toBe(parentId);
		expect(context.folders.listChildren(parentId)).toHaveLength(1);
	});

	test("rejects a duplicate sibling name regardless of case", async () => {
		await create("Food");

		expect(create("food")).rejects.toBeInstanceOf(DuplicateFolderNameError);
	});

	test("allows the same name under two different parents", async () => {
		const programming = await create("Programming");
		const english = await create("English");

		await create("Basics", programming);
		const id = await create("Basics", english);

		expect(nameOf(id)).toBe("Basics");
	});

	test("rejects an unknown parent", async () => {
		expect(create("SQL", "missing" as FolderId)).rejects.toBeInstanceOf(
			FolderNotFoundError,
		);
	});

	test("rejects a folder past the depth limit", async () => {
		const deepest = await chain("l1", "l2", "l3", "l4", "l5", "l6");

		expect(create("l7", deepest)).rejects.toBeInstanceOf(FolderDepthError);
	});
});

describe("RenameFolder", () => {
	test("renames a folder", async () => {
		const id = await create("Programing");

		await renameFolder.execute({ folderId: id, name: "Programming" });

		expect(nameOf(id)).toBe("Programming");
	});

	test("rejects a rename that collides with a sibling", async () => {
		const parentId = await create("Programming");
		await create("SQL", parentId);
		const id = await create("Rust", parentId);

		expect(
			renameFolder.execute({ folderId: id, name: "sql" }),
		).rejects.toBeInstanceOf(DuplicateFolderNameError);
	});

	test("accepts renaming a folder to its own name", async () => {
		const id = await create("SQL");

		await renameFolder.execute({ folderId: id, name: "SQL" });

		expect(nameOf(id)).toBe("SQL");
	});

	test("rejects an unknown folder", async () => {
		expect(
			renameFolder.execute({ folderId: "missing" as FolderId, name: "SQL" }),
		).rejects.toBeInstanceOf(FolderNotFoundError);
	});
});

describe("MoveFolder", () => {
	test("moves a folder to another parent", async () => {
		const programming = await create("Programming");
		const english = await create("English");
		const id = await create("Basics", programming);

		await moveFolder.execute({ folderId: id, parentId: english });

		expect(context.folders.findById(id)?.parentId).toBe(english);
		expect(context.folders.listChildren(programming)).toHaveLength(0);
	});

	test("moves a folder to the root", async () => {
		const programming = await create("Programming");
		const id = await create("SQL", programming);

		await moveFolder.execute({ folderId: id, parentId: undefined });

		expect(context.folders.findById(id)?.parentId).toBeUndefined();
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

		expect(context.folders.findById(subtreeRoot)?.parentId).toBe(destination);
	});
});

describe("DeleteFolder", () => {
	test("deletes an empty folder", async () => {
		const id = await create("Scratch");

		await deleteFolder.execute({ folderId: id });

		expect(context.folders.findById(id)).toBeUndefined();
	});

	test("refuses a folder that still has a child", async () => {
		const parentId = await create("English");
		await create("Vocabulary", parentId);

		expect(deleteFolder.execute({ folderId: parentId })).rejects.toBeInstanceOf(
			FolderNotEmptyError,
		);
	});

	test("rejects an unknown folder", async () => {
		expect(
			deleteFolder.execute({ folderId: "missing" as FolderId }),
		).rejects.toBeInstanceOf(FolderNotFoundError);
	});
});

describe("EnsureFolderPath", () => {
	const path = ["English", "Vocabulary", "By levels", "A1"];

	test("creates the whole chain and reports every segment", async () => {
		const result = await ensureFolderPath.execute({ path });

		expect(result.created).toEqual(path);
		expect(nameOf(result.folderId)).toBe("A1");
		expect(context.folders.listAncestors(result.folderId)).toHaveLength(3);
	});

	test("is idempotent", async () => {
		const first = await ensureFolderPath.execute({ path });
		const second = await ensureFolderPath.execute({ path });

		expect(second.folderId).toBe(first.folderId);
		expect(second.created).toEqual([]);
		expect(context.folders.listAll()).toHaveLength(4);
	});

	test("creates only the missing tail under an existing prefix", async () => {
		await ensureFolderPath.execute({ path: ["English", "Vocabulary"] });

		const result = await ensureFolderPath.execute({ path });

		expect(result.created).toEqual(["By levels", "A1"]);
	});

	test("matches existing segments case-insensitively", async () => {
		const first = await ensureFolderPath.execute({ path: ["English"] });
		const second = await ensureFolderPath.execute({ path: ["english"] });

		expect(second.folderId).toBe(first.folderId);
		expect(nameOf(second.folderId)).toBe("English");
	});

	test("rejects an empty path", () => {
		expect(ensureFolderPath.execute({ path: [] })).rejects.toBeInstanceOf(
			Error,
		);
	});

	test("rejects a path deeper than the limit", () => {
		expect(
			ensureFolderPath.execute({
				path: ["a", "b", "c", "d", "e", "f", "g"],
			}),
		).rejects.toBeInstanceOf(FolderDepthError);
	});
});
