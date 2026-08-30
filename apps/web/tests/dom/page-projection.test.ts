import { describe, expect, test } from "bun:test";
import type { PageTreeNode } from "@recall/contracts";
import {
	descendantsOf,
	project,
	visibleNodes,
} from "@/features/pages/ui/components/PageTree.projection";

const INDENT = 12;

const node = (id: string, depth: number, parentId?: string): PageTreeNode => ({
	id,
	name: id,
	parentId,
	depth,
	setCount: 0,
	unpublishedCount: 0,
});

const tree = [
	node("a", 0),
	node("a1", 1, "a"),
	node("a1x", 2, "a1"),
	node("b", 0),
	node("c", 0),
];

const at = (activeId: string, overId: string, indents = 0) =>
	project(tree, activeId, overId, indents * INDENT, INDENT);

describe("which pages a drag carries with it", () => {
	test("a page brings its whole subtree, however deep", () => {
		expect(descendantsOf(tree, "a").toSorted()).toEqual(["a1", "a1x"]);
	});

	test("a leaf brings nothing", () => {
		expect(descendantsOf(tree, "c")).toEqual([]);
	});
});

describe("which pages the tree shows", () => {
	test("collapsing a page hides its whole subtree, not just its children", () => {
		expect(visibleNodes(tree, new Set(["a"])).map((page) => page.id)).toEqual([
			"a",
			"b",
			"c",
		]);
	});

	test("collapsing a leaf changes nothing", () => {
		expect(visibleNodes(tree, new Set(["c"]))).toHaveLength(5);
	});

	test("nothing collapsed shows everything", () => {
		expect(visibleNodes(tree, new Set())).toHaveLength(5);
	});
});

describe("where a drag would land", () => {
	test("a page takes the place of the row it is dropped on", () => {
		expect(at("c", "b")).toEqual({
			depth: 0,
			parentId: undefined,
			afterId: "a",
			beforeId: "b",
		});
	});

	test("dragged sideways, it nests under the page it now sits below", () => {
		expect(at("c", "b", 1)).toEqual({
			depth: 1,
			parentId: "a",
			afterId: "a1",
			beforeId: undefined,
		});
	});

	test("it can never sit deeper than one level below the page above it", () => {
		expect(at("c", "b", 5)?.depth).toBe(3);
		expect(at("c", "a", 5)?.depth).toBe(0);
	});

	test("dropped on the first row it goes to the very top", () => {
		expect(at("c", "a")).toEqual({
			depth: 0,
			parentId: undefined,
			afterId: undefined,
			beforeId: "a",
		});
	});

	test("a page dragged out to the left rejoins the root", () => {
		expect(at("a1x", "c", -5)).toEqual({
			depth: 0,
			parentId: undefined,
			afterId: "c",
			beforeId: undefined,
		});
	});

	test("a page carries its subtree, so the neighbours skip it", () => {
		expect(at("a", "c")).toEqual({
			depth: 0,
			parentId: undefined,
			afterId: "c",
			beforeId: undefined,
		});
	});

	test("landing among nested pages names the sibling it precedes", () => {
		expect(at("c", "a1x")).toEqual({
			depth: 2,
			parentId: "a1",
			afterId: undefined,
			beforeId: "a1x",
		});
	});

	test("moving up and moving down both change something", () => {
		const up = at("c", "b");
		const down = at("a", "b");

		expect(up?.afterId).toBe("a");
		expect(down?.afterId).toBe("b");
	});
});

describe("drags that must not be possible", () => {
	test("a page cannot be dropped inside its own subtree", () => {
		expect(at("a", "a1")).toBeUndefined();
		expect(at("a", "a1x")).toBeUndefined();
	});

	test("a page the tree does not hold projects nothing", () => {
		expect(at("ghost", "b")).toBeUndefined();
		expect(at("c", "ghost")).toBeUndefined();
	});

	test("an indent of zero would divide by zero, so it projects nothing", () => {
		expect(project(tree, "c", "b", 0, 0)).toBeUndefined();
	});
});
