import type {
	QuizAttempt,
	QuizAttemptId,
} from "@/domain/quiz-attempt/quiz-attempt";
import type { QuestionId } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";

export interface AttemptStatistics {
	readonly attemptId: QuizAttemptId;
	readonly quizSetId: QuizSetId;
	readonly correct: number;
	readonly total: number;
	readonly completedAt?: Date;
}

export interface TopicAccuracy {
	readonly topic: string | undefined;
	readonly answered: number;
	readonly correct: number;
}

export interface QuizAttemptRepository {
	save(attempt: QuizAttempt): void;
	findById(id: QuizAttemptId): QuizAttempt | undefined;
	findActiveByUser(telegramUserId: number): QuizAttempt | undefined;
	listCompletedBySet(
		telegramUserId: number,
		quizSetId: QuizSetId,
	): readonly AttemptStatistics[];
	topicAccuracy(telegramUserId: number): readonly TopicAccuracy[];
	incorrectQuestionIds(telegramUserId: number): readonly QuestionId[];
}
