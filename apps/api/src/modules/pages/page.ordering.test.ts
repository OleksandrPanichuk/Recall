import { describe, expect, test } from "bun:test";
import { PagePosition } from "./page.ordering";
import { FolderValidationError } from "./pages.errors";

describe("placing one sibling among the others", () => {
	test("the very first sibling starts at the step, not at zero", () => {
		expect(PagePosition.between(undefined, undefined)).toBe(1);
	});

	test("appending goes one step past the last", () => {
		expect(PagePosition.between(4, undefined)).toBe(5);
	});

	test("prepending goes one step below the first, even past zero", () => {
		expect(PagePosition.between(undefined, 1)).toBe(0);
		expect(PagePosition.between(undefined, 0)).toBe(-1);
	});

	test("landing between two takes the midpoint", () => {
		expect(PagePosition.between(1, 2)).toBe(1.5);
		expect(PagePosition.between(1.5, 2)).toBe(1.75);
	});

	test("the midpoint is rounded to what the column can actually hold", () => {
		const between = PagePosition.between(1, 1 + 3 * 10 ** -PagePosition.SCALE);

		expect(Number(between.toFixed(PagePosition.SCALE))).toBe(between);
	});

	test("a pair with no room between them is refused, not silently collapsed", () => {
		const tight = 10 ** -PagePosition.SCALE;

		expect(PagePosition.canSitBetween(1, 1 + tight)).toBe(false);
		expect(() => PagePosition.between(1, 1 + tight)).toThrow(
			FolderValidationError,
		);
	});

	test("siblings given in the wrong order are refused", () => {
		expect(() => PagePosition.between(2, 1)).toThrow(FolderValidationError);
		expect(() => PagePosition.between(1, 1)).toThrow(FolderValidationError);
	});

	test("halving repeatedly runs out, and says so rather than duplicating", () => {
		let before = 1;
		const after = 2;
		let placed = 0;

		while (PagePosition.canSitBetween(before, after)) {
			before = PagePosition.between(before, after);
			placed += 1;

			expect(before).toBeLessThan(after);
			expect(placed).toBeLessThan(200);
		}

		expect(placed).toBeGreaterThan(20);
		expect(() => PagePosition.between(before, after)).toThrow();
	});
});

describe("renumbering a crowded parent", () => {
	test("hands out evenly spaced positions from one", () => {
		expect(PagePosition.renumbered(3)).toEqual([1, 2, 3]);
	});

	test("an empty parent needs nothing", () => {
		expect(PagePosition.renumbered(0)).toEqual([]);
	});
});

describe("rounding", () => {
	test("keeps what the column holds and drops what it cannot", () => {
		expect(PagePosition.round(1.12345678901234)).toBe(1.123456789);
	});
});
