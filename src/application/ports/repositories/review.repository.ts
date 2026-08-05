import type { QuestionId } from "@/domain/quiz-set/question";
import type { ReviewItem } from "@/domain/review/review-item";

export interface ReviewRepository {
	/**
	 * Upserts on `(telegramUserId, questionId)`, so repeatedly getting the same
	 * question wrong never grows the queue.
	 */
	save(item: ReviewItem): void;
	findByQuestion(
		telegramUserId: number,
		questionId: QuestionId,
	): ReviewItem | undefined;
	/** Items due at or before `now` and not retired, soonest first. */
	listDue(
		telegramUserId: number,
		now: Date,
		limit: number,
	): readonly ReviewItem[];
	/** Every item still in rotation, due or not. */
	countPending(telegramUserId: number): number;
}
