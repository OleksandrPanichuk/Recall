import { describe, expect, test } from "bun:test";
import type { PageTreeNode } from "@recall/contracts";
import { pageChoices } from "@/features/authoring/ui/components/MoveQuizSet/MoveQuizSet.lib";

const node = (
	id: string,
	name: string,
	depth: number,
	parentId?: string,
): PageTreeNode => ({
	id,
	name,
	parentId,
	depth,
	setCount: 0,
	unpublishedCount: 0,
});

const tree = [
	node("books", "Books", 0),
	node("ddia", "DDIA", 1, "books"),
	node("english", "English", 0),
];

describe("where a quiz set may be filed", () => {
	test("every page, when the set is filed nowhere", () => {
		expect(pageChoices(tree, undefined).map((choice) => choice.id)).toEqual([
			"books",
			"ddia",
			"english",
		]);
	});

	test("no way out is offered to a set that is already loose", () => {
		expect(
			pageChoices(tree, undefined).map((choice) => choice.name),
		).not.toContain("Outside any page");
	});

	test("a filed set can be taken back out", () => {
		expect(pageChoices(tree, "ddia")[0]).toEqual({
			id: undefined,
			name: "Outside any page",
			depth: 0,
		});
	});

	test("never back into the page it already sits in", () => {
		expect(pageChoices(tree, "ddia").map((choice) => choice.id)).not.toContain(
			"ddia",
		);
	});

	test("a child page is still offered, unlike moving a page into itself", () => {
		expect(pageChoices(tree, "books").map((choice) => choice.id)).toContain(
			"ddia",
		);
	});
});
