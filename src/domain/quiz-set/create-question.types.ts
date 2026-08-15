import type { Difficulty, QuestionType } from "./question.constants";
import type { QuestionId, QuestionOption } from "./question.types";

export interface QuestionDraft {
	readonly id: QuestionId;
	readonly type: QuestionType;
	readonly prompt: string;
	readonly difficulty: Difficulty;
	readonly position: number;
	readonly options: readonly QuestionOption[];
	readonly explanation?: string;
	readonly sourceReference?: string;
	readonly topic?: string;
	readonly hint?: string;
}
