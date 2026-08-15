import { describe, expect, test } from "bun:test";
import { trimmedOrUndefined } from "./text";

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
