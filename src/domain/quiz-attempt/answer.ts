import type { Question, QuestionOptionId } from "../quiz-set/question";
import { QuizAttemptValidationError } from "./quiz-attempt.errors";

export function correctOptionIds(
	question: Question,
): readonly QuestionOptionId[] {
	return question.options
		.filter((option) => option.isCorrect)
		.map((option) => option.id);
}

/**
 * An answer is correct when the selected options are exactly the correct ones —
 * no extras, no omissions. One rule covers all three question types; single
 * choice and true/false simply have exactly one correct option.
 */
export function evaluateAnswer(
	question: Question,
	selectedOptionIds: readonly QuestionOptionId[],
): boolean {
	if (selectedOptionIds.length === 0) {
		throw new QuizAttemptValidationError([
			"selectedOptionIds must not be empty",
		]);
	}

	const known = new Set(question.options.map((option) => option.id));

	if (selectedOptionIds.some((optionId) => !known.has(optionId))) {
		throw new QuizAttemptValidationError([
			"selectedOptionIds must belong to the question",
		]);
	}

	const selected = new Set(selectedOptionIds);
	const correct = correctOptionIds(question);

	return (
		selected.size === correct.length &&
		correct.every((optionId) => selected.has(optionId))
	);
}
