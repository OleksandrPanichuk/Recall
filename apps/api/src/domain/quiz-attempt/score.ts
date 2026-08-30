import { QuizAttemptValidationError } from "./quiz-attempt.errors";
import type { QuestionResponse } from "./quiz-attempt.types";

export interface Score {
	readonly correct: number;
	readonly total: number;
	readonly percentage: number;
}

const creditOf = (response: QuestionResponse): number => {
	const possible = response.creditPossible ?? 1;
	const earned = response.creditEarned ?? (response.isCorrect ? 1 : 0);

	return possible === 0 ? 0 : earned / possible;
};
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
	const earned = responses.reduce(
		(sum, response) => sum + creditOf(response),
		0,
	);

	return Object.freeze({
		correct: total === 0 ? 0 : correct,
		total,
		percentage: total === 0 ? 0 : Math.round((earned / total) * 1000) / 10,
	});
}
