import type {
	QuizAttempt,
	QuizAttemptId,
} from "@/domain/quiz-attempt/quiz-attempt";
import type { QuestionId } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";

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

export interface AttemptRepository {
	save(attempt: QuizAttempt): Promise<void>;
	findById(id: QuizAttemptId): Promise<QuizAttempt | undefined>;
	findActive(): Promise<QuizAttempt | undefined>;
	listCompletedForQuiz(
		quizId: QuizSetId,
	): Promise<readonly AttemptStatistics[]>;
	topicAccuracy(quizId: QuizSetId): Promise<readonly TopicAccuracy[]>;
	incorrectQuestionIds(quizId: QuizSetId): Promise<readonly QuestionId[]>;
	answerCount(questionId: QuestionId): Promise<number>;
}
