import { beforeEach, describe, expect, test } from "bun:test";
import {
	createPagesHarness,
	type PagesHarness,
} from "@tests/fixtures/pages.use-cases";
import { type PageId, PagePosition } from "@/modules/pages";
import { FolderValidationError } from "../pages.errors";
import type { ReorderPageUseCase } from "./reorder-page";

let harness: PagesHarness;
let reorder: ReorderPageUseCase;

beforeEach(() => {
	harness = createPagesHarness();
	reorder = harness.reorderPage;
});

const named = async (...names: readonly string[]): Promise<PageId[]> => {
	const ids: PageId[] = [];

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
			folderId: mango as PageId,
			beforeId: (await harness.context.scope.pages.listChildren(undefined))[0]
				?.id,
		});

		expect(await order()).toEqual(["Mango", "Zebra", "Apple"]);
	});

	test("a page lands between the two it was pointed at", async () => {
		const [zebra, apple, mango] = await named("Zebra", "Apple", "Mango");

		await reorder.execute({
			folderId: mango as PageId,
			afterId: zebra as PageId,
			beforeId: apple as PageId,
		});

		expect(await order()).toEqual(["Zebra", "Mango", "Apple"]);
	});

	test("a page moves to the end when nothing is put after it", async () => {
		const [zebra, , mango] = await named("Zebra", "Apple", "Mango");

		await reorder.execute({
			folderId: zebra as PageId,
			afterId: mango as PageId,
		});

		expect(await order()).toEqual(["Apple", "Mango", "Zebra"]);
	});

	test("reordering one parent leaves another alone", async () => {
		const [outer] = await named("Outer");
		const inner = await harness.create("Inner", outer as PageId);
		const [zebra, apple] = await named("Zebra", "Apple");

		await reorder.execute({
			folderId: apple as PageId,
			beforeId: zebra as PageId,
		});

		expect(await order()).toEqual(["Apple", "Outer", "Zebra"]);
		expect(
			(await harness.context.scope.pages.listChildren(outer as PageId)).map(
				(page) => page.name,
			),
		).toEqual(["Inner"]);
		expect(String(inner)).not.toBe("");
	});

	test("a sibling from another parent is refused, not silently ignored", async () => {
		const [outer, zebra] = await named("Outer", "Zebra");
		const inner = await harness.create("Inner", outer as PageId);

		expect(
			reorder.execute({
				folderId: zebra as PageId,
				beforeId: inner,
			}),
		).rejects.toThrow(FolderValidationError);
	});

	test("a page cannot be placed next to itself", async () => {
		const [zebra] = await named("Zebra", "Apple");

		expect(
			reorder.execute({
				folderId: zebra as PageId,
				beforeId: zebra as PageId,
			}),
		).rejects.toThrow(FolderValidationError);
	});

	test("running out of room renumbers the parent instead of failing", async () => {
		const [first, second] = await named("First", "Second");
		const quantum = 10 ** -PagePosition.SCALE;

		let nearest = second as PageId;

		for (let round = 0; round < 40; round += 1) {
			const wedged = await harness.create(`Wedge ${round}`);

			await reorder.execute({
				folderId: wedged,
				afterId: first as PageId,
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
