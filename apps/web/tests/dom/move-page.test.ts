import { describe, expect, test } from "bun:test";
import type { PageTreeNode } from "@recall/contracts";
import { destinationsFor } from "@/features/pages/ui/components/MovePage/MovePage.lib";

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
	node("ch1", "Chapter 1", 2, "ddia"),
	node("english", "English", 0),
];

describe("where a page may be moved", () => {
	test("never into itself", () => {
		expect(
			destinationsFor(tree, "ddia", "books").map((d) => d.id),
		).not.toContain("ddia");
	});

	test("never into its own descendant, which would orphan the branch", () => {
		expect(
			destinationsFor(tree, "ddia", "books").map((d) => d.id),
		).not.toContain("ch1");
	});

	test("never into the parent it already has", () => {
		expect(
			destinationsFor(tree, "ddia", "books").map((d) => d.id),
		).not.toContain("books");
	});

	test("offers the library to a page that has a parent", () => {
		expect(destinationsFor(tree, "ddia", "books")[0]).toEqual({
			id: undefined,
			name: "Бібліотека",
			depth: 0,
		});
	});

	test("does not offer the library to a page already at the root", () => {
		expect(
			destinationsFor(tree, "english", undefined).map((d) => d.name),
		).not.toContain("Бібліотека");
	});

	test("leaves the unrelated branches available", () => {
		expect(destinationsFor(tree, "ddia", "books").map((d) => d.id)).toContain(
			"english",
		);
	});
});
