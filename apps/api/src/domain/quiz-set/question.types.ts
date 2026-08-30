import type { BrandedId } from "../branded-id";
import type { Difficulty, QuestionType } from "./question.constants";

export type QuestionId = BrandedId<"QuestionId">;
export type QuestionOptionId = BrandedId<"QuestionOptionId">;

export interface QuestionOption {
	readonly id: QuestionOptionId;
	readonly text: string;
	readonly isCorrect: boolean;
	readonly position: number;
	readonly matchKey?: string;
}

interface QuestionFields {
	readonly id: QuestionId;
	readonly prompt: string;
	readonly options: readonly QuestionOption[];
	readonly difficulty: Difficulty;
	readonly position: number;
	readonly explanation?: string;
	readonly sourceReference?: string;
	readonly topic?: string;
	readonly hint?: string;
	readonly vocabularyItemId?: string;
}

export interface SingleChoiceQuestion extends QuestionFields {
	readonly type: typeof QuestionType.SingleChoice;
}

export interface MultipleChoiceQuestion extends QuestionFields {
	readonly type: typeof QuestionType.MultipleChoice;
}

export interface TrueFalseQuestion extends QuestionFields {
	readonly type: typeof QuestionType.TrueFalse;
}

export interface TypedAnswerQuestion extends QuestionFields {
	readonly type: typeof QuestionType.TypedAnswer;
}

export interface ClozeQuestion extends QuestionFields {
	readonly type: typeof QuestionType.Cloze;
}

export interface OrderingQuestion extends QuestionFields {
	readonly type: typeof QuestionType.Ordering;
}

export interface MatchingQuestion extends QuestionFields {
	readonly type: typeof QuestionType.Matching;
}

export type Question =
	| SingleChoiceQuestion
	| MultipleChoiceQuestion
	| TrueFalseQuestion
	| TypedAnswerQuestion
	| ClozeQuestion
	| OrderingQuestion
	| MatchingQuestion;

export interface MatchingSides {
	readonly left: readonly QuestionOption[];
	readonly right: readonly QuestionOption[];
}
