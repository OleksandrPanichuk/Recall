import type { Database } from "bun:sqlite";
import type { ReviewRepository } from "@/application/ports/repositories/review.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { QuestionId } from "@/domain/quiz-set/question";
import { type ReviewItem, ReviewItemState } from "@/domain/review/review-item";
import {
	type ReviewItemRow,
	toReviewItem,
	toReviewItemRow,
} from "./review-item.mapper";

// The unique index on (telegram_user_id, question_id) is the aggregate's real
// identity: answering the same question wrong again updates the queued item
// instead of adding another one. The row keeps the id it was first stored with.
const upsertReviewItemSql = `
	INSERT INTO review_items (
		id, question_id, telegram_user_id, state, streak,
		due_at, created_at, last_reviewed_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT (telegram_user_id, question_id) DO UPDATE SET
		state = excluded.state,
		streak = excluded.streak,
		due_at = excluded.due_at,
		created_at = excluded.created_at,
		last_reviewed_at = excluded.last_reviewed_at`;

export function createSqliteReviewRepository(
	database: Database,
	transaction: Transaction,
): ReviewRepository {
	const upsertReviewItem = database.query(upsertReviewItemSql);
	const selectByQuestion = database.query<ReviewItemRow, [number, string]>(
		"SELECT * FROM review_items WHERE telegram_user_id = ? AND question_id = ?",
	);
	const selectDue = database.query<
		ReviewItemRow,
		[number, string, string, number]
	>(
		`SELECT * FROM review_items
		WHERE telegram_user_id = ?
			AND due_at <= ?
			AND state <> ?
		ORDER BY due_at ASC, id ASC
		LIMIT ?`,
	);
	const countNotRetired = database.query<{ total: number }, [number, string]>(
		`SELECT count(*) AS total FROM review_items
		WHERE telegram_user_id = ? AND state <> ?`,
	);

	return {
		save(item: ReviewItem): void {
			const row = toReviewItemRow(item);

			transaction.run(() => {
				upsertReviewItem.run(
					row.id,
					row.question_id,
					row.telegram_user_id,
					row.state,
					row.streak,
					row.due_at,
					row.created_at,
					row.last_reviewed_at,
				);
			});
		},

		findByQuestion(
			telegramUserId: number,
			questionId: QuestionId,
		): ReviewItem | undefined {
			const row = selectByQuestion.get(telegramUserId, questionId);

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

			return selectDue
				.all(telegramUserId, now.toISOString(), ReviewItemState.Retired, limit)
				.map(toReviewItem);
		},

		countPending(telegramUserId: number): number {
			return (
				countNotRetired.get(telegramUserId, ReviewItemState.Retired)?.total ?? 0
			);
		},
	};
}
