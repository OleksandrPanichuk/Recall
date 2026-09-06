import { describe, expect, test } from "bun:test";
import { gradeOf, isFeltGrade, RecallGrade, wasRecalled } from "./grade";

describe("turning an answer into a grade", () => {
	test("a wrong answer is Again, whatever the learner felt", () => {
		expect(gradeOf(false, undefined)).toBe(RecallGrade.Again);
		expect(gradeOf(false, RecallGrade.Easy)).toBe(RecallGrade.Again);
		expect(gradeOf(false, RecallGrade.Hard)).toBe(RecallGrade.Again);
	});

	test("a right answer nobody rated is Good, which is what it was before", () => {
		expect(gradeOf(true, undefined)).toBe(RecallGrade.Good);
	});

	test("a right answer the learner rated keeps that rating", () => {
		expect(gradeOf(true, RecallGrade.Hard)).toBe(RecallGrade.Hard);
		expect(gradeOf(true, RecallGrade.Easy)).toBe(RecallGrade.Easy);
		expect(gradeOf(true, RecallGrade.Good)).toBe(RecallGrade.Good);
	});

	test("a right answer cannot be talked down to Again", () => {
		expect(gradeOf(true, RecallGrade.Again)).toBe(RecallGrade.Good);
	});
});

describe("which gradings a learner may offer", () => {
	test("the three that follow a correct answer", () => {
		expect(isFeltGrade("hard")).toBe(true);
		expect(isFeltGrade("good")).toBe(true);
		expect(isFeltGrade("easy")).toBe(true);
	});

	test("but never Again, which is the answer's own verdict", () => {
		expect(isFeltGrade("again")).toBe(false);
	});

	test("and nothing that is not a grade at all", () => {
		expect(isFeltGrade("great")).toBe(false);
		expect(isFeltGrade(undefined)).toBe(false);
		expect(isFeltGrade(2)).toBe(false);
	});
});

describe("whether a grade counts as remembering", () => {
	test("everything but Again does", () => {
		expect(wasRecalled(RecallGrade.Hard)).toBe(true);
		expect(wasRecalled(RecallGrade.Good)).toBe(true);
		expect(wasRecalled(RecallGrade.Easy)).toBe(true);
	});

	test("Again does not, which is what a lapse is counted from", () => {
		expect(wasRecalled(RecallGrade.Again)).toBe(false);
	});
});
