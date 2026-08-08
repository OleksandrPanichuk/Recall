import { and, asc, count, eq, lte, ne } from "drizzle-orm";
import type { ReviewRepository } from "@/application/ports/repositories/review.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { QuestionId } from "@/domain/quiz-set/question";
import { type ReviewItem, ReviewItemState } from "@/domain/review/review-item";
import type { QuizDatabase } from "../database";
import { reviewItems } from "../schema";
import { toReviewItem, toReviewItemRow } from "./review-item.mapper";

export function createSqliteReviewRepository(
	database: QuizDatabase,
	transaction: Transaction,
): ReviewRepository {
	const notRetired = ne(reviewItems.state, ReviewItemState.Retired);

	return {
		save(item: ReviewItem): void {
			const row = toReviewItemRow(item);

			transaction.run(() => {
				const stored = database
					.select({ lastReviewedAt: reviewItems.lastReviewedAt })
					.from(reviewItems)
					.where(
						and(
							eq(reviewItems.telegramUserId, row.telegramUserId),
							eq(reviewItems.questionId, row.questionId),
						),
					)
					.get();

				// lastReviewedAt is the entry's clock: the transitions refuse to review
				// an item before it. A writer holding an older snapshot would otherwise
				// silently erase a streak the user earned, or put a retired question
				// back into rotation.
				if (
					stored?.lastReviewedAt != null &&
					(row.lastReviewedAt == null ||
						row.lastReviewedAt < stored.lastReviewedAt)
				) {
					return;
				}

				// The unique index on (telegram_user_id, question_id) is the queue
				// entry's real identity: answering the same question wrong again updates
				// the entry instead of adding another one. Only the review state is
				// updated — id and createdAt belong to the entry, not to the snapshot
				// being written, so they keep recording which entry this is and when the
				// question first entered the queue.
				database
					.insert(reviewItems)
					.values(row)
					.onConflictDoUpdate({
						target: [reviewItems.telegramUserId, reviewItems.questionId],
						set: {
							state: row.state,
							streak: row.streak,
							dueAt: row.dueAt,
							lastReviewedAt: row.lastReviewedAt ?? null,
						},
					})
					.run();
			});
		},

		findByQuestion(
			telegramUserId: number,
			questionId: QuestionId,
		): ReviewItem | undefined {
			const row = database
				.select()
				.from(reviewItems)
				.where(
					and(
						eq(reviewItems.telegramUserId, telegramUserId),
						eq(reviewItems.questionId, questionId),
					),
				)
				.get();

			return row ? toReviewItem(row) : undefined;
		},

		listDue(
			telegramUserId: number,
			now: Date,
			limit: number,
		): readonly ReviewItem[] {
			if (!Number.isSafeInteger(limit) || limit <= 0) {
				throw new RangeError("limit must be a positive integer");
			}

			return database
				.select()
				.from(reviewItems)
				.where(
					and(
						eq(reviewItems.telegramUserId, telegramUserId),
						lte(reviewItems.dueAt, now.toISOString()),
						notRetired,
					),
				)
				.orderBy(asc(reviewItems.dueAt), asc(reviewItems.id))
				.limit(limit)
				.all()
				.map(toReviewItem);
		},

		listOutstanding(
			telegramUserId: number,
			limit: number,
		): readonly ReviewItem[] {
			if (!Number.isSafeInteger(limit) || limit <= 0) {
				throw new RangeError("limit must be a positive integer");
			}

			return database
				.select()
				.from(reviewItems)
				.where(and(eq(reviewItems.telegramUserId, telegramUserId), notRetired))
				.orderBy(asc(reviewItems.dueAt), asc(reviewItems.id))
				.limit(limit)
				.all()
				.map(toReviewItem);
		},

		countPending(telegramUserId: number): number {
			return (
				database
					.select({ total: count() })
					.from(reviewItems)
					.where(
						and(eq(reviewItems.telegramUserId, telegramUserId), notRetired),
					)
					.get()?.total ?? 0
			);
		},
	};
}
