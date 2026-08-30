import { describe, expect, test } from "bun:test";
import { editDistance, isWithinOneEdit } from "./edit-distance";

describe("editDistance", () => {
	test.each([
		["cat", "cat", 0],
		["cat", "cot", 1],
		["cat", "cats", 1],
		["cat", "at", 1],
		["cta", "cat", 1],
		["", "cat", 3],
	])("%p to %p is %i", (left, right, expected) => {
		expect(editDistance(left, right)).toBe(expected);
	});

	test("counts a transposition as one edit, not two", () => {
		expect(editDistance("recieve", "receive")).toBe(1);
		expect(editDistance("teh", "the")).toBe(1);
	});
});

describe("isWithinOneEdit", () => {
	test("flags a single-character slip", () => {
		expect(isWithinOneEdit("recieved", "received")).toBe(true);
	});

	test("flags the transposition people actually type", () => {
		expect(isWithinOneEdit("recieve", "receive")).toBe(true);
	});

	test("does not flag an exact match", () => {
		expect(isWithinOneEdit("cat", "cat")).toBe(false);
	});

	test("does not flag a different word", () => {
		expect(isWithinOneEdit("cat", "dog")).toBe(false);
	});
});
