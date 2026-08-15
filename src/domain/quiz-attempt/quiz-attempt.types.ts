import type { BrandedId } from "../branded-id";
import type { QuestionId, QuestionOptionId } from "../quiz-set/question";
import type { QuizSetId } from "../quiz-set/quiz-set";
import type {
	QuizAttemptMode,
	QuizAttemptStatus,
} from "./quiz-attempt.constants";

export type QuizAttemptId = BrandedId<"QuizAttemptId">;

export interface QuestionResponse {
	readonly questionId: QuestionId;
	readonly selectedOptionIds: readonly QuestionOptionId[];
	readonly isCorrect: boolean;
	readonly answeredAt: Date;
	readonly typedAnswer?: string;
	readonly skipped?: boolean;
	readonly creditEarned?: number;
	readonly creditPossible?: number;
}

export interface QuizAttempt {
	readonly id: QuizAttemptId;
	readonly quizSetId: QuizSetId;
	readonly telegramUserId: number;
	readonly mode: QuizAttemptMode;
	readonly status: QuizAttemptStatus;
	readonly questionIds: readonly QuestionId[];
	readonly responses: readonly QuestionResponse[];
	readonly startedAt: Date;
	readonly updatedAt: Date;
	readonly completedAt?: Date;
}

export interface QuizAttemptDraft {
	readonly id: QuizAttemptId;
	readonly quizSetId: QuizSetId;
	readonly telegramUserId: number;
	readonly mode: QuizAttemptMode;
	readonly questionIds: readonly QuestionId[];
	readonly startedAt: Date;
}

export interface QuizAttemptSnapshot {
	readonly id: QuizAttemptId;
	readonly quizSetId: QuizSetId;
	readonly telegramUserId: number;
	readonly mode: QuizAttemptMode;
	readonly status: QuizAttemptStatus;
	readonly questionIds: readonly QuestionId[];
	readonly responses: readonly QuestionResponse[];
	readonly startedAt: Date;
	readonly updatedAt: Date;
	readonly completedAt?: Date;
}
