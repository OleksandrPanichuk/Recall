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
	/** Upserts the attempt; recorded responses are never overwritten or doubled. */
	save(attempt: QuizAttempt): void;
	findById(id: QuizAttemptId): QuizAttempt | undefined;
	/** The user's single unfinished attempt — active or paused — if one exists. */
	findActiveByUser(telegramUserId: number): QuizAttempt | undefined;
	/** Completed attempts only, oldest first, so improvement can be measured. */
	listCompletedBySet(
		telegramUserId: number,
		quizSetId: QuizSetId,
	): readonly AttemptStatistics[];
	topicAccuracy(telegramUserId: number): readonly TopicAccuracy[];
	/** Questions answered incorrectly and not answered correctly since. */
	incorrectQuestionIds(telegramUserId: number): readonly QuestionId[];
}
