import type { QuestionId } from "@/domain/quiz-set/question";
import type { ReviewItem } from "@/domain/review/review-item";

export interface ReviewRepository {
	/**
	 * Upserts on `(telegramUserId, questionId)`, so repeatedly getting the same
	 * question wrong never grows the queue. The queue entry owns its `id` and
	 * `createdAt`: saving a freshly built item for an already-queued question
	 * updates the review state and keeps the stored ones. A save that would move
	 * the entry's `lastReviewedAt` backwards is ignored.
	 */
	save(item: ReviewItem): void;
	findByQuestion(
		telegramUserId: number,
		questionId: QuestionId,
	): ReviewItem | undefined;
	/**
	 * Items due at or before `now` and not retired, soonest first. `limit` must
	 * be a positive integer; implementations reject anything else rather than
	 * guessing a default.
	 */
	listDue(
		telegramUserId: number,
		now: Date,
		limit: number,
	): readonly ReviewItem[];
	/** Every item still in rotation, due or not. */
	countPending(telegramUserId: number): number;
}
