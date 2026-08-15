import { describe, expect, test } from "bun:test";
import { normaliseForComparison, trimmedOrUndefined } from "./text";

describe("trimmedOrUndefined", () => {
	test("returns undefined for undefined", () => {
		expect(trimmedOrUndefined(undefined)).toBeUndefined();
	});

	test("returns undefined for a blank string", () => {
		expect(trimmedOrUndefined("   \n\t ")).toBeUndefined();
	});

	test("returns undefined for an empty string", () => {
		expect(trimmedOrUndefined("")).toBeUndefined();
	});

	test("trims surrounding whitespace", () => {
		expect(trimmedOrUndefined("  spaced out  ")).toBe("spaced out");
	});

	test("keeps an already trimmed value", () => {
		expect(trimmedOrUndefined("value")).toBe("value");
	});
});

describe("normaliseForComparison", () => {
	test.each([
		["cat", "cat"],
		["  CAT  ", "cat"],
		["Don’t", "don't"],
		["don`t", "don't"],
		["donʼt", "don't"],
		["a  lot   of", "a lot of"],
		["Yes!", "yes"],
		["Really?!", "really"],
		["ВЕЛИКИЙ", "великий"],
	])("normalises %p to %p", (input, expected) => {
		expect(normaliseForComparison(input)).toBe(expected);
	});

	test("treats the two apostrophes a phone might send as one answer", () => {
		expect(normaliseForComparison("don’t")).toBe(
			normaliseForComparison("don't"),
		);
	});

	test("keeps an internal full stop", () => {
		expect(normaliseForComparison("e.g.")).toBe("e.g");
	});
});
