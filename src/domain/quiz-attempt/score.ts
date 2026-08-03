import type { QuestionResponse } from "./quiz-attempt";
import { QuizAttemptValidationError } from "./quiz-attempt.errors";

export interface Score {
	readonly correct: number;
	readonly total: number;
	readonly percentage: number;
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

	if (total === 0) {
		return Object.freeze({ correct: 0, total: 0, percentage: 0 });
	}

	return Object.freeze({
		correct,
		total,
		percentage: Math.round((correct / total) * 1000) / 10,
	});
}
