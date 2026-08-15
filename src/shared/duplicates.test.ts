import { describe, expect, test } from "bun:test";
import { hasDuplicates } from "./duplicates";

describe("hasDuplicates", () => {
	test("reports no duplicates for an empty list", () => {
		expect(hasDuplicates([])).toBe(false);
	});

	test("reports no duplicates for unique values", () => {
		expect(hasDuplicates(["a", "b", "c"])).toBe(false);
	});

	test("reports duplicates for a repeated value", () => {
		expect(hasDuplicates(["a", "b", "a"])).toBe(true);
	});

	test("compares values exactly", () => {
		expect(hasDuplicates(["a", "A"])).toBe(false);
	});
});
