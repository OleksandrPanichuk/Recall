import { type Question, QuestionType } from "../quiz-set/question";
import {
	evaluateOptions,
	evaluateOrder,
	evaluateText,
	gradePairs,
} from "./answer.evaluators";
import type { Answer, AnswerGrade } from "./answer.types";
import { QuizAttemptValidationError } from "./quiz-attempt.errors";

export { acceptedAnswers, correctOptionIds } from "./answer.evaluators";
export type { Answer, OptionPair } from "./answer.types";
export {
	optionsAnswer,
	orderAnswer,
	pairsAnswer,
	textAnswer,
} from "./answer.types";

const whole = (correct: boolean): AnswerGrade => ({
	earned: correct ? 1 : 0,
	possible: 1,
});

export const isFullyCorrect = (grade: AnswerGrade): boolean =>
	grade.possible > 0 && grade.earned === grade.possible;

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

export function gradeAnswer(question: Question, answer: Answer): AnswerGrade {
	if (answer.kind !== expectedKind(question)) {
		throw new QuizAttemptValidationError([
			`${question.type} expects a ${expectedKind(question)} answer`,
		]);
	}

	switch (answer.kind) {
		case "options":
			return whole(evaluateOptions(question, answer.optionIds));
		case "text":
			return whole(evaluateText(question, answer.text));
		case "order":
			return whole(evaluateOrder(question, answer.optionIds));
		case "pairs":
			return gradePairs(question, answer.pairs);
	}
}

export function evaluateAnswer(question: Question, answer: Answer): boolean {
	return isFullyCorrect(gradeAnswer(question, answer));
}
