import { describe, expect, test } from "bun:test";
import type { PageTreeNode } from "@recall/contracts";
import { slotFor } from "@/features/pages/ui/components/PageTree/PageTree.lib";

const node = (id: string, parentId?: string): PageTreeNode => ({
	id,
	name: id,
	parentId,
	depth: parentId === undefined ? 0 : 1,
	setCount: 0,
	unpublishedCount: 0,
});

const roots = [node("a"), node("b"), node("c")];

describe("which two siblings a page should land between", () => {
	test("the first cannot go up and the last cannot go down", () => {
		expect(slotFor(roots, node("a"), "up")).toBeUndefined();
		expect(slotFor(roots, node("c"), "down")).toBeUndefined();
	});

	test("moving up from the second puts it before the first, with nothing after", () => {
		expect(slotFor(roots, node("b"), "up")).toEqual({
			afterId: undefined,
			beforeId: "a",
		});
	});

	test("moving down from the second puts it between the third and nothing", () => {
		expect(slotFor(roots, node("b"), "down")).toEqual({
			afterId: "c",
			beforeId: undefined,
		});
	});

	test("moving up from the third lands it between the first and the second", () => {
		expect(slotFor(roots, node("c"), "up")).toEqual({
			afterId: "a",
			beforeId: "b",
		});
	});

	test("only siblings count, never the whole tree", () => {
		const nested = [node("a"), node("child", "a"), node("b")];

		expect(slotFor(nested, node("child", "a"), "up")).toBeUndefined();
		expect(slotFor(nested, node("child", "a"), "down")).toBeUndefined();
		expect(slotFor(nested, node("b"), "up")).toEqual({
			afterId: undefined,
			beforeId: "a",
		});
	});

	test("a page the tree does not hold has no slot", () => {
		expect(slotFor(roots, node("ghost"), "up")).toBeUndefined();
	});
});
