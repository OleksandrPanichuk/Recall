import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { TestContext } from "@tests/fixtures/application.fixture";
import type { FolderId } from "@/domain/folder/folder";
import { DuplicateFolderNameError } from "@/domain/folder/folder.errors";
import { FolderNotFoundError } from "./create-folder";
import { createFoldersHarness, type FoldersHarness } from "./folders.fixture";
import type { RenameFolder } from "./rename-folder";

let context: TestContext;
let renameFolder: RenameFolder;
let create: FoldersHarness["create"];
let nameOf: FoldersHarness["nameOf"];

beforeEach(() => {
	({ context, renameFolder, create, nameOf } = createFoldersHarness());
});

afterEach(() => {
	context.close();
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
