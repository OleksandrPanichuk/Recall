import type { QuestionResponse } from "./quiz-attempt";
import { QuizAttemptValidationError } from "./quiz-attempt.errors";

export interface Score {
	readonly correct: number;
	readonly total: number;
	readonly percentage: number;
}

/** The single rounding rule for every percentage the app reports. */
export function percentageOf(correct: number, total: number): number {
	return total === 0 ? 0 : Math.round((correct / total) * 1000) / 10;
}

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

	return Object.freeze({
		correct: total === 0 ? 0 : correct,
		total,
		percentage: percentageOf(correct, total),
	});
}
