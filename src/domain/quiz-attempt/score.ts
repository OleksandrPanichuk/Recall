import type { QuestionResponse } from "./quiz-attempt";
import { QuizAttemptValidationError } from "./quiz-attempt.errors";

export interface Score {
	readonly correct: number;
	readonly total: number;
	/** 0..100, rounded to one decimal. */
	readonly percentage: number;
}

/**
 * `total` is the planned question count, never `responses.length`: an abandoned
 * attempt must not score 100% just because every answer it did record was right.
 *
 * The total is validated rather than clamped because callers outside the
 * aggregate — Phase 2.3 statistics reads a persisted count — could otherwise
 * produce a percentage above 100 or `NaN`, silently breaking the 0..100
 * contract this type advertises.
 */
export function calculateScore(
	responses: readonly QuestionResponse[],
	total: number,
): Score {
	if (!Number.isSafeInteger(total) || total < 0) {
		throw new QuizAttemptValidationError([
			"total must be a non-negative integer",
		]);
	}

	if (responses.length > total) {
		throw new QuizAttemptValidationError([
			"total must not be smaller than the number of responses",
		]);
	}

	const correct = responses.filter((response) => response.isCorrect).length;

	// An empty plan has no percentage to report, and dividing by it would yield
	// NaN.
	if (total === 0) {
		return Object.freeze({ correct: 0, total: 0, percentage: 0 });
	}

	return Object.freeze({
		correct,
		total,
		percentage: Math.round((correct / total) * 1000) / 10,
	});
}
