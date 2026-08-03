import type { QuestionResponse } from "./quiz-attempt";

export interface Score {
	readonly correct: number;
	readonly total: number;
	/** 0..100, rounded to one decimal. */
	readonly percentage: number;
}

/**
 * `total` is the planned question count, never `responses.length`: an abandoned
 * attempt must not score 100% just because every answer it did record was right.
 */
export function calculateScore(
	responses: readonly QuestionResponse[],
	total: number,
): Score {
	const correct = responses.filter((response) => response.isCorrect).length;

	// A plan with no questions has no percentage to report, and dividing by it
	// would yield NaN.
	if (total <= 0) {
		return Object.freeze({ correct: 0, total: 0, percentage: 0 });
	}

	return Object.freeze({
		correct,
		total,
		percentage: Math.round((correct / total) * 1000) / 10,
	});
}
