import { type Question, QuestionType } from "../quiz-set/question";
import {
	evaluateOptions,
	evaluateOrder,
	evaluatePairs,
	evaluateText,
} from "./answer.evaluators";
import type { Answer } from "./answer.types";
import { QuizAttemptValidationError } from "./quiz-attempt.errors";

export { acceptedAnswers, correctOptionIds } from "./answer.evaluators";
export type { Answer, OptionPair } from "./answer.types";
export {
	optionsAnswer,
	orderAnswer,
	pairsAnswer,
	textAnswer,
} from "./answer.types";

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
