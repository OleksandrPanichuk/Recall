import type { QuestionId } from "../quiz-set/question";
import type { QuizSetId } from "../quiz-set/quiz-set";

export type SchedulerKind = "ladder" | "fsrs";

export interface RepetitionSettings {
	readonly scheduler: SchedulerKind;
	readonly intervalsDays: readonly number[];
	readonly maxIntervalDays: number;
	readonly maxRepetitions: number;
	readonly desiredRetention: number;
}

export interface RepetitionSchedule {
	readonly questionId: QuestionId;
	readonly telegramUserId?: number;
	readonly repetitionCount: number;
	readonly lapses: number;
	readonly lastCompletedAt: Date;
	readonly dueAt?: Date;
	readonly stability?: number;
	readonly difficulty?: number;
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
