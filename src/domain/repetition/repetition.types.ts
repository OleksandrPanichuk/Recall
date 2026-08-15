import type { QuizSetId } from "../quiz-set/quiz-set";

export interface RepetitionSettings {
	readonly intervalsDays: readonly number[];
	readonly maxIntervalDays: number;
	readonly maxRepetitions: number;
}

export interface RepetitionSchedule {
	readonly quizSetId: QuizSetId;
	readonly telegramUserId: number;
	readonly repetitionCount: number;
	readonly lastCompletedAt: Date;
	readonly dueAt?: Date;
}

export interface DueRepetition {
	readonly quizSetId: QuizSetId;
	readonly dueAt: Date;
	readonly overdueDays: number;
	readonly repetitionCount: number;
}
