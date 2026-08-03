import { type BrandedId, brandedId } from "../branded-id";

export type QuestionId = BrandedId<"QuestionId">;
export type QuestionOptionId = BrandedId<"QuestionOptionId">;

export const toQuestionId = (value: string): QuestionId =>
	brandedId<"QuestionId">(value, "QuestionId");

export const toQuestionOptionId = (value: string): QuestionOptionId =>
	brandedId<"QuestionOptionId">(value, "QuestionOptionId");

export const QuestionType = {
	SingleChoice: "single_choice",
	MultipleChoice: "multiple_choice",
	TrueFalse: "true_false",
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export function isQuestionType(value: unknown): value is QuestionType {
	return (Object.values(QuestionType) as readonly unknown[]).includes(value);
}

export const Difficulty = {
	Easy: "easy",
	Medium: "medium",
	Hard: "hard",
} as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

export function isDifficulty(value: unknown): value is Difficulty {
	return (Object.values(Difficulty) as readonly unknown[]).includes(value);
}

export interface QuestionOption {
	readonly id: QuestionOptionId;
	readonly text: string;
	readonly isCorrect: boolean;
	readonly position: number;
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

export type Question =
	| SingleChoiceQuestion
	| MultipleChoiceQuestion
	| TrueFalseQuestion;
