import { describe, expect, test } from "bun:test";
import { toQuestionId, toQuestionOptionId } from "../quiz-set/question";
import type { QuestionResponse } from "./quiz-attempt";
import { QuizAttemptValidationError } from "./quiz-attempt.errors";
import { calculateScore } from "./score";

const answeredAt = new Date("2026-08-01T10:00:00.000Z");

const response = (name: string, isCorrect: boolean): QuestionResponse => ({
	questionId: toQuestionId(`question-${name}`),
	selectedOptionIds: [toQuestionOptionId(`option-${name}`)],
	isCorrect,
	answeredAt,
});

const correctResponses = (count: number): readonly QuestionResponse[] =>
	Array.from({ length: count }, (_unused, index) =>
		response(`correct-${index}`, true),
	);

const issuesOf = (
	responses: readonly QuestionResponse[],
	total: number,
): readonly string[] => {
	try {
		calculateScore(responses, total);
	} catch (caught) {
		expect(caught).toBeInstanceOf(QuizAttemptValidationError);

		return (caught as QuizAttemptValidationError).issues;
	}

	throw new Error("expected calculateScore to throw");
};

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

		test.each([
			[1, 3, 33.3],
			[2, 3, 66.7],
			[1, 6, 16.7],
			[5, 6, 83.3],
		])("rounds %p correct of %p to %p percent", (correct, total, percentage) => {
			expect(calculateScore(correctResponses(correct), total)).toEqual({
				correct,
				total,
				percentage,
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

	describe("with an invalid total", () => {
		test.each([
			Number.NaN,
			-1,
			2.5,
			Number.POSITIVE_INFINITY,
		])("rejects the total %p", (total) => {
			expect(issuesOf([], total)).toEqual([
				"total must be a non-negative integer",
			]);
		});

		test("rejects a total smaller than the number of responses", () => {
			expect(issuesOf(correctResponses(2), 1)).toEqual([
				"total must not be smaller than the number of responses",
			]);
		});

		test("names the issue in the error message", () => {
			expect(() => calculateScore([], -1)).toThrow(
				"Invalid quiz attempt:\n- total must be a non-negative integer",
			);
		});

		test("accepts a total equal to the number of responses", () => {
			expect(calculateScore(correctResponses(2), 2).percentage).toBe(100);
		});
	});
});
