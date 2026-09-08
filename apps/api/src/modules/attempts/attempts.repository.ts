import { type QuestionId, type QuizSetId } from "@/modules/quizzes";
import type { AttemptEntity } from "./attempt.entity";
import type { QuizAttemptId } from "./attempt.entity.types";

export interface AttemptStatistics {
	readonly attemptId: QuizAttemptId;
	readonly quizId: QuizSetId;
	readonly correct: number;
	readonly total: number;
	readonly completedAt?: Date;
}

export interface TopicAccuracy {
	readonly topic: string | undefined;
	readonly answered: number;
	readonly correct: number;
}

export abstract class AttemptsRepository {
	abstract save(attempt: AttemptEntity): Promise<void>;
	abstract findById(id: QuizAttemptId): Promise<AttemptEntity | undefined>;
	abstract findActive(): Promise<AttemptEntity | undefined>;
	abstract listCompletedForQuiz(
		quizId: QuizSetId,
	): Promise<readonly AttemptStatistics[]>;
	abstract topicAccuracy(quizId: QuizSetId): Promise<readonly TopicAccuracy[]>;
	abstract incorrectQuestionIds(
		quizId: QuizSetId,
	): Promise<readonly QuestionId[]>;
	abstract answerCount(questionId: QuestionId): Promise<number>;
	abstract delete(id: QuizAttemptId): Promise<void>;
}
