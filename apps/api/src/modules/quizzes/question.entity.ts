import { brandedId } from "@/core/branded-id";
import { QuestionType } from "./question.constants";
import type {
	ClozeQuestion,
	MatchingQuestion,
	MatchingSides,
	MultipleChoiceQuestion,
	OrderingQuestion,
	QuestionId,
	QuestionOptionId,
	SingleChoiceQuestion,
	TrueFalseQuestion,
	TypedAnswerQuestion,
} from "./question.entity.types";

export {
	CLOZE_BLANK,
	Difficulty,
	isDifficulty,
	isQuestionType,
	QuestionType,
} from "./question.constants";
export type {
	ClozeQuestion,
	MatchingQuestion,
	MatchingSides,
	MultipleChoiceQuestion,
	OrderingQuestion,
	QuestionId,
	QuestionOption,
	QuestionOptionId,
	SingleChoiceQuestion,
	TrueFalseQuestion,
	TypedAnswerQuestion,
} from "./question.entity.types";

export const toQuestionId = (value: string): QuestionId =>
	brandedId<"QuestionId">(value, "QuestionId");

export const toQuestionOptionId = (value: string): QuestionOptionId =>
	brandedId<"QuestionOptionId">(value, "QuestionOptionId");

export type QuestionEntity =
	| SingleChoiceQuestion
	| MultipleChoiceQuestion
	| TrueFalseQuestion
	| TypedAnswerQuestion
	| ClozeQuestion
	| OrderingQuestion
	| MatchingQuestion;

export namespace QuestionEntity {
	export function expectsTypedAnswer(question: QuestionEntity): boolean {
		return (
			question.type === QuestionType.TypedAnswer ||
			question.type === QuestionType.Cloze
		);
	}

	export function matchingSides(question: QuestionEntity): MatchingSides {
		const ordered = question.options.toSorted(
			(left, right) => left.position - right.position,
		);
		const half = ordered.length / 2;

		return { left: ordered.slice(0, half), right: ordered.slice(half) };
	}
}
