import { describe, expect, test } from "bun:test";
import {
	QuizAttemptMode,
	QuizAttemptStatus,
} from "@/domain/quiz-attempt/quiz-attempt";
import { QuizAttemptValidationError } from "@/domain/quiz-attempt/quiz-attempt.errors";
import {
	CorruptedQuizAttemptRowError,
	type QuestionResponseRow,
	type QuizAttemptRow,
	toQuizAttempt,
} from "./quiz-attempt.mapper";

const aQuizAttemptRow = (
	overrides: Partial<QuizAttemptRow> = {},
): QuizAttemptRow => ({
	id: "attempt-1",
	quiz_set_id: "set-1",
	telegram_user_id: 42,
	mode: QuizAttemptMode.Full,
	status: QuizAttemptStatus.Active,
	question_ids: '["question-1","question-2"]',
	started_at: "2026-08-01T10:00:00.000Z",
	updated_at: "2026-08-01T10:05:00.000Z",
	completed_at: null,
	...overrides,
});

const aResponseRow = (
	overrides: Partial<QuestionResponseRow> = {},
): QuestionResponseRow => ({
	attempt_id: "attempt-1",
	question_id: "question-1",
	selected_option_ids: '["option-1"]',
	is_correct: 1,
	answered_at: "2026-08-01T10:05:00.000Z",
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
		expect(() => restore({ question_ids: "not json" })).toThrow(
			CorruptedQuizAttemptRowError,
		);
		expect(() => restore({ question_ids: '["question-1", 7]' })).toThrow(
			CorruptedQuizAttemptRowError,
		);
	});

	test("rejects selected_option_ids that are not a JSON array of strings", () => {
		expect(() =>
			restore({}, [aResponseRow({ selected_option_ids: "not json" })]),
		).toThrow(CorruptedQuizAttemptRowError);
	});

	test("rejects an is_correct value outside 0 and 1", () => {
		expect(() => restore({}, [aResponseRow({ is_correct: 2 })])).toThrow(
			CorruptedQuizAttemptRowError,
		);
	});

	test("rejects unparsable timestamps", () => {
		expect(() => restore({ started_at: "nonsense" })).toThrow(
			CorruptedQuizAttemptRowError,
		);
		expect(() => restore({ updated_at: "nonsense" })).toThrow(
			CorruptedQuizAttemptRowError,
		);
		expect(() =>
			restore({}, [aResponseRow({ answered_at: "nonsense" })]),
		).toThrow(CorruptedQuizAttemptRowError);
	});

	test("rejects a response for a question outside the plan", () => {
		expect(() =>
			restore({}, [aResponseRow({ question_id: "question-99" })]),
		).toThrow(CorruptedQuizAttemptRowError);
	});

	test("rejects a gap in the answered plan", () => {
		expect(() =>
			restore({ question_ids: '["question-1","question-2","question-3"]' }, [
				aResponseRow(),
				aResponseRow({
					question_id: "question-3",
					answered_at: "2026-08-01T10:06:00.000Z",
				}),
			]),
		).toThrow(CorruptedQuizAttemptRowError);
	});

	// Plan order is authoritative; the factory refuses to silently reorder a row
	// set whose timestamps contradict it.
	test("rejects timestamps that disagree with plan order", () => {
		expect(() =>
			restore({ updated_at: "2026-08-01T10:06:00.000Z" }, [
				aResponseRow({ answered_at: "2026-08-01T10:06:00.000Z" }),
				aResponseRow({
					question_id: "question-2",
					answered_at: "2026-08-01T10:05:00.000Z",
				}),
			]),
		).toThrow(QuizAttemptValidationError);
	});
});
