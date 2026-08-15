import { describe, expect, test } from "bun:test";
import {
	editDistance,
	isNearMiss,
	normaliseAnswer,
} from "./answer-normalisation";

describe("normaliseAnswer", () => {
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
		expect(normaliseAnswer(input)).toBe(expected);
	});

	test("treats the two apostrophes a phone might send as the same answer", () => {
		expect(normaliseAnswer("don’t")).toBe(normaliseAnswer("don't"));
	});

	test("keeps an internal full stop", () => {
		expect(normaliseAnswer("e.g.")).toBe("e.g");
	});
});

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
});

describe("isNearMiss", () => {
	test("flags a single-character slip", () => {
		expect(isNearMiss("recieved", "received")).toBe(true);
	});

	test("flags a transposition, which is the typo people actually make", () => {
		expect(isNearMiss("recieve", "receive")).toBe(true);
		expect(isNearMiss("teh", "the")).toBe(true);
	});

	test("does not flag an exact match", () => {
		expect(isNearMiss("cat", "cat")).toBe(false);
	});

	test("does not flag a different word", () => {
		expect(isNearMiss("cat", "dog")).toBe(false);
	});
});
