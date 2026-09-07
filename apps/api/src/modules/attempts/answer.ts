import {
	QuestionEntity,
	type QuestionOptionId,
	QuestionType,
} from "@/modules/quizzes";
import {
	acceptedAnswers,
	correctOptionIds,
	evaluateOptions,
	evaluateOrder,
	evaluateText,
	gradePairs,
} from "./answer.evaluators";
import type {
	AnswerGrade,
	Answer as AnswerShape,
	OptionPair,
} from "./answer.types";
import { QuizAttemptValidationError } from "./attempts.errors";

export type { AnswerGrade, OptionPair } from "./answer.types";

export type Answer = AnswerShape;

const whole = (correct: boolean): AnswerGrade => ({
	earned: correct ? 1 : 0,
	possible: 1,
});

const expectedKind = (question: QuestionEntity): AnswerShape["kind"] => {
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

export namespace Answer {
	export function options(optionIds: readonly QuestionOptionId[]): AnswerShape {
		return { kind: "options", optionIds };
	}

	export function text(value: string): AnswerShape {
		return { kind: "text", text: value };
	}

	export function order(optionIds: readonly QuestionOptionId[]): AnswerShape {
		return { kind: "order", optionIds };
	}

	export function pairs(values: readonly OptionPair[]): AnswerShape {
		return { kind: "pairs", pairs: values };
	}

	export function acceptedFor(question: QuestionEntity): readonly string[] {
		return acceptedAnswers(question);
	}

	export function correctOptionsOf(
		question: QuestionEntity,
	): readonly QuestionOptionId[] {
		return correctOptionIds(question);
	}

	export function isFullyCorrect(grade: AnswerGrade): boolean {
		return grade.possible > 0 && grade.earned === grade.possible;
	}

	export function grade(
		question: QuestionEntity,
		answer: AnswerShape,
	): AnswerGrade {
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

	export function evaluate(
		question: QuestionEntity,
		answer: AnswerShape,
	): boolean {
		return isFullyCorrect(grade(question, answer));
	}
}
