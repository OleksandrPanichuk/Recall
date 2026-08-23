import { describe, expect, test } from "bun:test";
import { shuffled } from "./shuffle";

const items = [0, 1, 2, 3, 4, 5, 6, 7];

describe("shuffled", () => {
	test("keeps every item exactly once", () => {
		expect([...shuffled(items, "q-1")].toSorted((a, b) => a - b)).toEqual(
			items,
		);
	});

	test("is stable for the same seed, so a re-render does not move a button", () => {
		expect(shuffled(items, "q-1")).toEqual(shuffled(items, "q-1"));
	});

	test("differs between questions", () => {
		expect(shuffled(items, "q-1")).not.toEqual(shuffled(items, "q-2"));
	});

	test("actually reorders", () => {
		expect(shuffled(items, "q-1")).not.toEqual(items);
	});

	test("handles the trivial sizes", () => {
		expect(shuffled([], "q-1")).toEqual([]);
		expect(shuffled([1], "q-1")).toEqual([1]);
	});
});
