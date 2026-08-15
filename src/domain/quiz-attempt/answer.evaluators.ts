import { normaliseForComparison } from "@/shared/utils/text";
import type { Question, QuestionOptionId } from "../quiz-set/question";
import type { AnswerGrade, OptionPair } from "./answer.types";
import { QuizAttemptValidationError } from "./quiz-attempt.errors";

export function correctOptionIds(
	question: Question,
): readonly QuestionOptionId[] {
	return question.options
		.filter((option) => option.isCorrect)
		.map((option) => option.id);
}

export function acceptedAnswers(question: Question): readonly string[] {
	return question.options
		.filter((option) => option.isCorrect)
		.map((option) => option.text);
}

const assertKnownOptions = (
	question: Question,
	optionIds: readonly QuestionOptionId[],
): void => {
	const known = new Set(question.options.map((option) => option.id));

	if (optionIds.some((optionId) => !known.has(optionId))) {
		throw new QuizAttemptValidationError([
			"selectedOptionIds must belong to the question",
		]);
	}
};

const assertNotEmpty = (optionIds: readonly QuestionOptionId[]): void => {
	if (optionIds.length === 0) {
		throw new QuizAttemptValidationError([
			"selectedOptionIds must not be empty",
		]);
	}
};

export function evaluateOptions(
	question: Question,
	optionIds: readonly QuestionOptionId[],
): boolean {
	assertNotEmpty(optionIds);
	assertKnownOptions(question, optionIds);

	const selected = new Set(optionIds);
	const correct = correctOptionIds(question);

	return (
		selected.size === correct.length &&
		correct.every((optionId) => selected.has(optionId))
	);
}

export function evaluateText(question: Question, text: string): boolean {
	const candidate = normaliseForComparison(text);

	if (candidate.length === 0) {
		throw new QuizAttemptValidationError(["answer must not be empty"]);
	}

	return acceptedAnswers(question).some(
		(accepted) => normaliseForComparison(accepted) === candidate,
	);
}

export function evaluateOrder(
	question: Question,
	optionIds: readonly QuestionOptionId[],
): boolean {
	assertNotEmpty(optionIds);
	assertKnownOptions(question, optionIds);

	const expected = question.options
		.toSorted((left, right) => left.position - right.position)
		.map((option) => option.id);

	return (
		optionIds.length === expected.length &&
		expected.every((optionId, index) => optionIds[index] === optionId)
	);
}

export function gradePairs(
	question: Question,
	pairs: readonly OptionPair[],
): AnswerGrade {
	if (pairs.length === 0) {
		throw new QuizAttemptValidationError(["pairs must not be empty"]);
	}

	assertKnownOptions(question, pairs.flat());

	const keyOf = new Map(
		question.options.map((option) => [option.id, option.matchKey]),
	);

	const possible = new Set(
		question.options
			.filter((option) => option.matchKey !== undefined)
			.map((option) => option.matchKey),
	).size;

	const matched = new Set<string>();

	for (const [left, right] of pairs) {
		const key = keyOf.get(left);

		if (
			key !== undefined &&
			key === keyOf.get(right) &&
			left !== right &&
			!matched.has(key)
		) {
			matched.add(key);
		}
	}

	return { earned: matched.size, possible };
}
