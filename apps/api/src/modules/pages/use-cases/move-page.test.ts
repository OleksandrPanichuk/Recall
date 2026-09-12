import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import {
	createPagesHarness,
	type PagesHarness,
} from "@tests/fixtures/pages.use-cases";
import {
	DuplicateFolderNameError,
	FolderCycleError,
	FolderDepthError,
} from "../pages.errors";
import type { MovePageUseCase } from "./move-page";

let context: MemoryContext;
let movePage: MovePageUseCase;
let create: PagesHarness["create"];
let chain: PagesHarness["chain"];

beforeEach(() => {
	({ context, movePage, create, chain } = createPagesHarness());
});

afterEach(() => {
	context.close();
});

describe("MovePageUseCase", () => {
	test("moves a folder to another parent", async () => {
		const programming = await create("Programming");
		const english = await create("English");
		const id = await create("Basics", programming);

		await movePage.execute({ folderId: id, parentId: english });

		expect((await context.scope.pages.findById(id))?.parentId).toBe(english);
		expect(await context.scope.pages.listChildren(programming)).toHaveLength(0);
	});

	test("moves a folder to the root", async () => {
		const programming = await create("Programming");
		const id = await create("SQL", programming);

		await movePage.execute({ folderId: id, parentId: undefined });

		expect((await context.scope.pages.findById(id))?.parentId).toBeUndefined();
	});

	test("rejects moving a folder under its own descendant", async () => {
		const parentId = await create("English");
		const childId = await create("Vocabulary", parentId);

		expect(
			movePage.execute({ folderId: parentId, parentId: childId }),
		).rejects.toBeInstanceOf(FolderCycleError);
	});

	test("rejects moving a folder into itself", async () => {
		const id = await create("English");

		expect(
			movePage.execute({ folderId: id, parentId: id }),
		).rejects.toBeInstanceOf(FolderCycleError);
	});

	test("rejects a move that collides with a name at the destination", async () => {
		const english = await create("English");
		await create("Basics", english);
		const id = await create("Basics");

		expect(
			movePage.execute({ folderId: id, parentId: english }),
		).rejects.toBeInstanceOf(DuplicateFolderNameError);
	});

	test("rejects a move that pushes the moved subtree past the depth limit", async () => {
		const subtreeRoot = await create("Subtree");
		const middle = await create("Middle", subtreeRoot);
		await create("Leaf", middle);

		const destination = await chain("d1", "d2", "d3", "d4");

		expect(
			movePage.execute({ folderId: subtreeRoot, parentId: destination }),
		).rejects.toBeInstanceOf(FolderDepthError);
	});

	test("allows a move that keeps the subtree inside the depth limit", async () => {
		const subtreeRoot = await create("Subtree");
		const middle = await create("Middle", subtreeRoot);
		await create("Leaf", middle);

		const destination = await chain("d1", "d2", "d3");

		await movePage.execute({ folderId: subtreeRoot, parentId: destination });

		expect((await context.scope.pages.findById(subtreeRoot))?.parentId).toBe(
			destination,
		);
	});
});

describe("where a moved page lands among its new siblings", () => {
	test("at the end, not wherever its old position happened to fall", async () => {
		const source = await create("Source");
		const target = await create("Target");

		await create("First", target);
		await create("Second", target);

		const drifter = await create("Drifter", source);

		await movePage.execute({ folderId: drifter, parentId: target });

		expect(
			(await context.scope.pages.listChildren(target)).map((page) => page.name),
		).toEqual(["First", "Second", "Drifter"]);
	});

	test("moving to the root puts it last there too", async () => {
		const outer = await create("Outer");
		const inner = await create("Inner", outer);

		await create("Later");
		await movePage.execute({ folderId: inner });

		expect(
			(await context.scope.pages.listChildren(undefined)).map(
				(page) => page.name,
			),
		).toEqual(["Outer", "Later", "Inner"]);
	});

	test("staying under the same parent keeps the order it had", async () => {
		const first = await create("First");
		await create("Second");

		await movePage.execute({ folderId: first });

		expect(
			(await context.scope.pages.listChildren(undefined)).map(
				(page) => page.name,
			),
		).toEqual(["First", "Second"]);
	});
});
