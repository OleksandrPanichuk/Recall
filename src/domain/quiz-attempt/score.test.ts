import { describe, expect, test } from "bun:test";
import { toQuestionId, toQuestionOptionId } from "../quiz-set/question";
import type { QuestionResponse } from "./quiz-attempt";
import { calculateScore } from "./score";

const answeredAt = new Date("2026-08-01T10:00:00.000Z");

const response = (name: string, isCorrect: boolean): QuestionResponse => ({
	questionId: toQuestionId(`question-${name}`),
	selectedOptionIds: [toQuestionOptionId(`option-${name}`)],
	isCorrect,
	answeredAt,
});

describe("calculateScore", () => {
	describe("with no responses", () => {
		test("reports a zero score for an empty plan", () => {
			expect(calculateScore([], 0)).toEqual({
				correct: 0,
				total: 0,
				percentage: 0,
			});
		});

		test("reports zero correct against a planned total", () => {
			expect(calculateScore([], 5)).toEqual({
				correct: 0,
				total: 5,
				percentage: 0,
			});
		});
	});

	describe("with mixed responses", () => {
		test("rounds the percentage to one decimal", () => {
			expect(
				calculateScore(
					[response("a", true), response("b", true), response("c", false)],
					3,
				),
			).toEqual({ correct: 2, total: 3, percentage: 66.7 });
		});

		test("reports a half-answered plan", () => {
			expect(calculateScore([response("a", true)], 2)).toEqual({
				correct: 1,
				total: 2,
				percentage: 50,
			});
		});
	});

	describe("with every answer correct", () => {
		test("reports one hundred percent", () => {
			expect(
				calculateScore([response("a", true), response("b", true)], 2),
			).toEqual({ correct: 2, total: 2, percentage: 100 });
		});
	});

	describe("total", () => {
		test("takes total from the argument, not from the response count", () => {
			const score = calculateScore([response("a", true)], 4);

			expect(score.total).toBe(4);
			expect(score.percentage).toBe(25);
		});

		test("returns a frozen score", () => {
			expect(Object.isFrozen(calculateScore([], 1))).toBe(true);
		});
	});
});
