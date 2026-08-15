import { normaliseAnswer } from "../quiz-set/answer-normalisation";
import {
	type Question,
	type QuestionOptionId,
	QuestionType,
} from "../quiz-set/question";
import { QuizAttemptValidationError } from "./quiz-attempt.errors";

export type OptionPair = readonly [QuestionOptionId, QuestionOptionId];

export type Answer =
	| {
			readonly kind: "options";
			readonly optionIds: readonly QuestionOptionId[];
	  }
	| { readonly kind: "text"; readonly text: string }
	| { readonly kind: "order"; readonly optionIds: readonly QuestionOptionId[] }
	| { readonly kind: "pairs"; readonly pairs: readonly OptionPair[] };

export const optionsAnswer = (
	optionIds: readonly QuestionOptionId[],
): Answer => ({ kind: "options", optionIds });

export const textAnswer = (text: string): Answer => ({ kind: "text", text });

export const orderAnswer = (
	optionIds: readonly QuestionOptionId[],
): Answer => ({
	kind: "order",
	optionIds,
});

export const pairsAnswer = (pairs: readonly OptionPair[]): Answer => ({
	kind: "pairs",
	pairs,
});

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

const expectedKind = (question: Question): Answer["kind"] => {
	switch (question.type) {
		case QuestionType.TypedAnswer:
		case QuestionType.Cloze:
			return "text";
		case QuestionType.Ordering:
			return "order";
		case QuestionType.Matching:
			return "pairs";
		default:
			return "options";
	}
};

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

const evaluateOptions = (
	question: Question,
	optionIds: readonly QuestionOptionId[],
): boolean => {
	if (optionIds.length === 0) {
		throw new QuizAttemptValidationError([
			"selectedOptionIds must not be empty",
		]);
	}

	assertKnownOptions(question, optionIds);

	const selected = new Set(optionIds);
	const correct = correctOptionIds(question);

	return (
		selected.size === correct.length &&
		correct.every((optionId) => selected.has(optionId))
	);
};

const evaluateText = (question: Question, text: string): boolean => {
	const candidate = normaliseAnswer(text);

	if (candidate.length === 0) {
		throw new QuizAttemptValidationError(["answer must not be empty"]);
	}

	return acceptedAnswers(question).some(
		(accepted) => normaliseAnswer(accepted) === candidate,
	);
};

const evaluateOrder = (
	question: Question,
	optionIds: readonly QuestionOptionId[],
): boolean => {
	if (optionIds.length === 0) {
		throw new QuizAttemptValidationError([
			"selectedOptionIds must not be empty",
		]);
	}

	assertKnownOptions(question, optionIds);

	const expected = question.options
		.toSorted((left, right) => left.position - right.position)
		.map((option) => option.id);

	return (
		optionIds.length === expected.length &&
		expected.every((optionId, index) => optionIds[index] === optionId)
	);
};

const evaluatePairs = (
	question: Question,
	pairs: readonly OptionPair[],
): boolean => {
	if (pairs.length === 0) {
		throw new QuizAttemptValidationError(["pairs must not be empty"]);
	}

	assertKnownOptions(question, pairs.flat());

	const keyOf = new Map(
		question.options.map((option) => [option.id, option.matchKey]),
	);
	const expectedPairs = new Set(
		question.options
			.filter((option) => option.matchKey !== undefined)
			.map((option) => option.matchKey),
	);

	if (pairs.length !== expectedPairs.size) {
		return false;
	}

	const matched = new Set<string>();

	for (const [left, right] of pairs) {
		const key = keyOf.get(left);

		if (
			key === undefined ||
			key !== keyOf.get(right) ||
			left === right ||
			matched.has(key)
		) {
			return false;
		}

		matched.add(key);
	}

	return true;
};

export function evaluateAnswer(question: Question, answer: Answer): boolean {
	if (answer.kind !== expectedKind(question)) {
		throw new QuizAttemptValidationError([
			`${question.type} expects a ${expectedKind(question)} answer`,
		]);
	}

	switch (answer.kind) {
		case "options":
			return evaluateOptions(question, answer.optionIds);
		case "text":
			return evaluateText(question, answer.text);
		case "order":
			return evaluateOrder(question, answer.optionIds);
		case "pairs":
			return evaluatePairs(question, answer.pairs);
	}
}
