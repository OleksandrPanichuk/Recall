import type { QuestionResponse } from "./attempt.entity.types";
import { QuizAttemptValidationError } from "./attempts.errors";

const creditOf = (response: QuestionResponse): number => {
	const possible = response.creditPossible ?? 1;
	const earned = response.creditEarned ?? (response.isCorrect ? 1 : 0);

	return possible === 0 ? 0 : earned / possible;
};

export interface Score {
	readonly correct: number;
	readonly total: number;
	readonly percentage: number;
}

export class Score {
	private constructor() {}

	static percentageOf(correct: number, total: number): number {
		return total === 0 ? 0 : Math.round((correct / total) * 1000) / 10;
	}

	static of(responses: readonly QuestionResponse[], total: number): Score {
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
}
