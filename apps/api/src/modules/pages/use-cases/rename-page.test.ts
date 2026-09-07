import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import {
	createPagesHarness,
	type PagesHarness,
} from "@tests/fixtures/pages.use-cases";
import { type PageId } from "@/modules/pages";
import { DuplicateFolderNameError, FolderNotFoundError } from "../pages.errors";
import type { RenamePageUseCase } from "./rename-page";

let context: MemoryContext;
let renamePage: RenamePageUseCase;
let create: PagesHarness["create"];
let nameOf: PagesHarness["nameOf"];

beforeEach(() => {
	({ context, renamePage, create, nameOf } = createPagesHarness());
});

afterEach(() => {
	context.close();
});

describe("RenamePageUseCase", () => {
	test("renames a folder", async () => {
		const id = await create("Programing");

		await renamePage.execute({ folderId: id, name: "Programming" });

		expect(await nameOf(id)).toBe("Programming");
	});

	test("rejects a rename that collides with a sibling", async () => {
		const parentId = await create("Programming");
		await create("SQL", parentId);
		const id = await create("Rust", parentId);

		expect(
			renamePage.execute({ folderId: id, name: "sql" }),
		).rejects.toBeInstanceOf(DuplicateFolderNameError);
	});

	test("accepts renaming a folder to its own name", async () => {
		const id = await create("SQL");

		await renamePage.execute({ folderId: id, name: "SQL" });

		expect(await nameOf(id)).toBe("SQL");
	});

	test("rejects an unknown folder", async () => {
		expect(
			renamePage.execute({ folderId: "missing" as PageId, name: "SQL" }),
		).rejects.toBeInstanceOf(FolderNotFoundError);
	});
});
