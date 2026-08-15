import type {
	QuestionInput,
	QuestionOptionInput,
} from "@/application/use-cases/quiz-sets/add-questions";
import { QuestionType } from "@/domain/quiz-set/question";
import type { QuestionSchemaInput } from "./question.schema";

const accepted = (texts: readonly string[]): readonly QuestionOptionInput[] =>
	texts.map((text) => ({ text, isCorrect: true }));

function optionsOf(
	question: QuestionSchemaInput,
): readonly QuestionOptionInput[] {
	switch (question.type) {
		case QuestionType.TypedAnswer:
		case QuestionType.Cloze:
			return accepted(question.acceptedAnswers ?? []);
		default:
			return question.options ?? [];
	}
}

export function toQuestionInput(question: QuestionSchemaInput): QuestionInput {
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
