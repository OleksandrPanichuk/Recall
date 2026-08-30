import { beforeEach, describe, expect, test } from "bun:test";
import type { FolderId } from "@/domain/folder/folder";
import { FolderValidationError } from "@/domain/folder/folder.errors";
import { POSITION_SCALE } from "@/domain/folder/ordering";
import { createFoldersHarness, type FoldersHarness } from "./folders.fixture";
import { ReorderFolderUseCase } from "./reorder-folder";

let harness: FoldersHarness;
let reorder: ReorderFolderUseCase;

beforeEach(() => {
	harness = createFoldersHarness();
	reorder = new ReorderFolderUseCase({
		unitOfWork: harness.context.unitOfWork,
		scope: harness.context.scope,
		clock: harness.context.clock,
		idGenerator: harness.context.idGenerator,
	});
});

const named = async (...names: readonly string[]): Promise<FolderId[]> => {
	const ids: FolderId[] = [];

	for (const name of names) {
		ids.push(await harness.create(name));
	}

	return ids;
};

const order = async (): Promise<readonly string[]> =>
	(await harness.context.scope.pages.listChildren(undefined)).map(
		(page) => page.name,
	);

describe("putting pages in the order their owner wants", () => {
	test("creation order is what you get before anyone reorders", async () => {
		await named("Zebra", "Apple", "Mango");

		expect(await order()).toEqual(["Zebra", "Apple", "Mango"]);
	});

	test("a page moves to the top when nothing is put before it", async () => {
		const [, , mango] = await named("Zebra", "Apple", "Mango");

		await reorder.execute({
			folderId: mango as FolderId,
			beforeId: (await harness.context.scope.pages.listChildren(undefined))[0]
				?.id,
		});

		expect(await order()).toEqual(["Mango", "Zebra", "Apple"]);
	});

	test("a page lands between the two it was pointed at", async () => {
		const [zebra, apple, mango] = await named("Zebra", "Apple", "Mango");

		await reorder.execute({
			folderId: mango as FolderId,
			afterId: zebra as FolderId,
			beforeId: apple as FolderId,
		});

		expect(await order()).toEqual(["Zebra", "Mango", "Apple"]);
	});

	test("a page moves to the end when nothing is put after it", async () => {
		const [zebra, , mango] = await named("Zebra", "Apple", "Mango");

		await reorder.execute({
			folderId: zebra as FolderId,
			afterId: mango as FolderId,
		});

		expect(await order()).toEqual(["Apple", "Mango", "Zebra"]);
	});

	test("reordering one parent leaves another alone", async () => {
		const [outer] = await named("Outer");
		const inner = await harness.create("Inner", outer as FolderId);
		const [zebra, apple] = await named("Zebra", "Apple");

		await reorder.execute({
			folderId: apple as FolderId,
			beforeId: zebra as FolderId,
		});

		expect(await order()).toEqual(["Apple", "Outer", "Zebra"]);
		expect(
			(await harness.context.scope.pages.listChildren(outer as FolderId)).map(
				(page) => page.name,
			),
		).toEqual(["Inner"]);
		expect(String(inner)).not.toBe("");
	});

	test("a sibling from another parent is refused, not silently ignored", async () => {
		const [outer, zebra] = await named("Outer", "Zebra");
		const inner = await harness.create("Inner", outer as FolderId);

		expect(
			reorder.execute({
				folderId: zebra as FolderId,
				beforeId: inner,
			}),
		).rejects.toThrow(FolderValidationError);
	});

	test("a page cannot be placed next to itself", async () => {
		const [zebra] = await named("Zebra", "Apple");

		expect(
			reorder.execute({
				folderId: zebra as FolderId,
				beforeId: zebra as FolderId,
			}),
		).rejects.toThrow(FolderValidationError);
	});

	test("running out of room renumbers the parent instead of failing", async () => {
		const [first, second] = await named("First", "Second");
		const quantum = 10 ** -POSITION_SCALE;

		let nearest = second as FolderId;

		for (let round = 0; round < 40; round += 1) {
			const wedged = await harness.create(`Wedge ${round}`);

			await reorder.execute({
				folderId: wedged,
				afterId: first as FolderId,
				beforeId: nearest,
			});

			nearest = wedged;
		}

		const children = await harness.context.scope.pages.listChildren(undefined);
		const positions = children.map((page) => page.position);

		expect(children[0]?.name).toBe("First");
		expect(children.at(-1)?.name).toBe("Second");
		expect(new Set(positions).size).toBe(children.length);

		for (const [index, position] of positions.slice(1).entries()) {
			expect(position - (positions[index] as number)).toBeGreaterThan(quantum);
		}
	});
});
