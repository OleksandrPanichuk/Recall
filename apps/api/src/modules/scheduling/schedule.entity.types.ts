import { type QuestionId, type QuizSetId } from "@/modules/quizzes";

export type SchedulerKind = "ladder" | "fsrs";

export interface RepetitionSettings {
	readonly scheduler: SchedulerKind;
	readonly intervalsDays: readonly number[];
	readonly maxIntervalDays: number;
	readonly maxRepetitions: number;
	readonly desiredRetention: number;
}

export interface DueSet {
	readonly quizSetId: QuizSetId;
	readonly title: string;
	readonly dueCount: number;
	readonly overdueDays: number;
	readonly dueQuestionIds: readonly QuestionId[];
}

export interface Leech {
	readonly questionId: QuestionId;
	readonly lapses: number;
}
