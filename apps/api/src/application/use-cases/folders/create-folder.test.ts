import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { TestContext } from "@tests/fixtures/application.fixture";
import type { FolderId } from "@/domain/folder/folder";
import {
	DuplicateFolderNameError,
	FolderDepthError,
} from "@/domain/folder/folder.errors";
import { FolderNotFoundError } from "./create-folder";
import { createFoldersHarness, type FoldersHarness } from "./folders.fixture";

let context: TestContext;
let create: FoldersHarness["create"];
let chain: FoldersHarness["chain"];
let nameOf: FoldersHarness["nameOf"];

beforeEach(() => {
	({ context, create, chain, nameOf } = createFoldersHarness());
});

afterEach(() => {
	context.close();
});

describe("CreateFolderUseCase", () => {
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
