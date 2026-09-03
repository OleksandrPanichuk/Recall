import type { QuestionDraft } from "@recall/contracts";
import type {
	QuestionInput,
	QuestionOptionInput,
} from "@/application/use-cases/quiz-sets/add-questions";
import { QuestionType } from "@/domain/quiz-set/question";

const accepted = (texts: readonly string[]): readonly QuestionOptionInput[] =>
	texts.map((text) => ({ text, isCorrect: true }));

const pairedOptions = (
	pairs: readonly { left: string; right: string }[],
): readonly QuestionOptionInput[] => [
	...pairs.map((pair, index) => ({
		text: pair.left,
		isCorrect: true,
		matchKey: `p${index}`,
	})),
	...pairs.map((pair, index) => ({
		text: pair.right,
		isCorrect: true,
		matchKey: `p${index}`,
	})),
];

function optionsOf(question: QuestionDraft): readonly QuestionOptionInput[] {
	switch (question.type) {
		case QuestionType.TypedAnswer:
		case QuestionType.Cloze:
			return accepted(question.acceptedAnswers ?? []);
		case QuestionType.Matching:
			return pairedOptions(question.pairs ?? []);
		case QuestionType.Ordering:
			return accepted(question.orderedItems ?? []);
		default:
			return question.options ?? [];
	}
}

export function toQuestionInput(question: QuestionDraft): QuestionInput {
	return {
		type: question.type,
		prompt: question.prompt,
		difficulty: question.difficulty,
		options: optionsOf(question),
		explanation: question.explanation,
		sourceReference: question.sourceReference,
		topic: question.topic,
		hint: question.hint,
	};
}

export interface AnswerContent {
	readonly options?: readonly QuestionOptionInput[];
	readonly acceptedAnswers?: readonly string[];
	readonly orderedItems?: readonly string[];
	readonly pairs?: readonly { left: string; right: string }[];
}

export function answerOptionsOf(
	content: AnswerContent,
): readonly QuestionOptionInput[] | undefined {
	if (content.pairs !== undefined) {
		return pairedOptions(content.pairs);
	}

	if (content.acceptedAnswers !== undefined) {
		return accepted(content.acceptedAnswers);
	}

	if (content.orderedItems !== undefined) {
		return accepted(content.orderedItems);
	}

	return content.options;
}
