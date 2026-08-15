import { describe, expect, test } from "bun:test";
import {
	QuizAttemptMode,
	QuizAttemptStatus,
} from "@/domain/quiz-attempt/quiz-attempt";
import { QuizAttemptValidationError } from "@/domain/quiz-attempt/quiz-attempt.errors";
import {
	CorruptedQuizAttemptRowError,
	toQuizAttempt,
} from "./quiz-attempt.mapper";
import type {
	QuestionResponseRow,
	QuizAttemptRow,
} from "./quiz-attempt.mapper.types";

const aQuizAttemptRow = (
	overrides: Partial<QuizAttemptRow> = {},
): QuizAttemptRow => ({
	id: "attempt-1",
	quizSetId: "set-1",
	telegramUserId: 42,
	mode: QuizAttemptMode.Full,
	status: QuizAttemptStatus.Active,
	questionIds: '["question-1","question-2"]',
	startedAt: "2026-08-01T10:00:00.000Z",
	updatedAt: "2026-08-01T10:05:00.000Z",
	completedAt: null,
	...overrides,
});

const aResponseRow = (
	overrides: Partial<QuestionResponseRow> = {},
): QuestionResponseRow => ({
	attemptId: "attempt-1",
	questionId: "question-1",
	selectedOptionIds: '["option-1"]',
	isCorrect: true,
	typedAnswer: null,
	skipped: null,
	creditEarned: null,
	creditPossible: null,
	answeredAt: "2026-08-01T10:05:00.000Z",
	...overrides,
});

const restore = (
	row: Partial<QuizAttemptRow> = {},
	responses: readonly QuestionResponseRow[] = [aResponseRow()],
) => toQuizAttempt(aQuizAttemptRow(row), responses);

describe("quiz attempt mapper", () => {
	test("restores an attempt with its responses", () => {
		const attempt = restore();

		expect(attempt.responses).toHaveLength(1);
		expect(attempt.responses[0]?.isCorrect).toBe(true);
		expect(attempt.questionIds.map(String)).toEqual([
			"question-1",
			"question-2",
		]);
	});

	test("rejects an unsupported mode", () => {
		expect(() => restore({ mode: "cram" })).toThrow(
			CorruptedQuizAttemptRowError,
		);
	});

	test("rejects an unsupported status", () => {
		expect(() => restore({ status: "retired" })).toThrow(
			CorruptedQuizAttemptRowError,
		);
	});

	test("rejects question_ids that are not a JSON array of strings", () => {
		expect(() => restore({ questionIds: "not json" })).toThrow(
			CorruptedQuizAttemptRowError,
		);
		expect(() => restore({ questionIds: '["question-1", 7]' })).toThrow(
			CorruptedQuizAttemptRowError,
		);
	});

	test("rejects selected_option_ids that are not a JSON array of strings", () => {
		expect(() =>
			restore({}, [aResponseRow({ selectedOptionIds: "not json" })]),
		).toThrow(CorruptedQuizAttemptRowError);
	});

	test("rejects unparsable timestamps", () => {
		expect(() => restore({ startedAt: "nonsense" })).toThrow(
			CorruptedQuizAttemptRowError,
		);
		expect(() => restore({ updatedAt: "nonsense" })).toThrow(
			CorruptedQuizAttemptRowError,
		);
		expect(() =>
			restore({}, [aResponseRow({ answeredAt: "nonsense" })]),
		).toThrow(CorruptedQuizAttemptRowError);
	});

	test("rejects a response for a question outside the plan", () => {
		expect(() =>
			restore({}, [aResponseRow({ questionId: "question-99" })]),
		).toThrow(CorruptedQuizAttemptRowError);
	});

	test("rejects a gap in the answered plan", () => {
		expect(() =>
			restore({ questionIds: '["question-1","question-2","question-3"]' }, [
				aResponseRow(),
				aResponseRow({
					questionId: "question-3",
					answeredAt: "2026-08-01T10:06:00.000Z",
				}),
			]),
		).toThrow(CorruptedQuizAttemptRowError);
	});

	test("rejects timestamps that disagree with plan order", () => {
		expect(() =>
			restore({ updatedAt: "2026-08-01T10:06:00.000Z" }, [
				aResponseRow({ answeredAt: "2026-08-01T10:06:00.000Z" }),
				aResponseRow({
					questionId: "question-2",
					answeredAt: "2026-08-01T10:05:00.000Z",
				}),
			]),
		).toThrow(QuizAttemptValidationError);
	});
});

describe("typed and skipped responses", () => {
	test("round-trips a typed answer", () => {
		const attempt = restore({}, [aResponseRow({ typedAnswer: "  DOG " })]);

		expect(attempt.responses[0]?.typedAnswer).toBe("  DOG ");
	});

	test("round-trips a skipped response", () => {
		const attempt = restore({}, [
			aResponseRow({
				isCorrect: false,
				selectedOptionIds: "[]",
				typedAnswer: null,
				skipped: true,
			}),
		]);

		expect(attempt.responses[0]?.skipped).toBe(true);
		expect(attempt.responses[0]?.typedAnswer).toBeUndefined();
	});
});
