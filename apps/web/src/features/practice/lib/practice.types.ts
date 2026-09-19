import type { QuizAttemptMode, ScheduledQuestion } from "@recall/contracts";

export interface Answer {
	readonly selectedOptionPositions?: readonly number[];
	readonly typedAnswer?: string;
	readonly revealed?: boolean;
}

export interface FinishedAttempt {
	readonly attemptId: string;
	readonly mode: QuizAttemptMode;
	readonly correct: number;
	readonly total: number;
	readonly percentage: number;
	readonly scheduled: readonly ScheduledQuestion[];
}
