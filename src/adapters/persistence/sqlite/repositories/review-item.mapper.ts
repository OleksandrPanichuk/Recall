import { toQuestionId } from "@/domain/quiz-set/question";
import {
	isReviewItemState,
	type ReviewItem,
	restoreReviewItem,
	toReviewItemId,
} from "@/domain/review/review-item";
import type { reviewItems } from "../schema";

export type ReviewItemRow = typeof reviewItems.$inferSelect;
export type ReviewItemInsert = typeof reviewItems.$inferInsert;

export class CorruptedReviewItemRowError extends Error {
	readonly issues: readonly string[];

	constructor(id: string, issues: readonly string[]) {
		super(
			`Review item ${id} cannot be restored from storage:\n${issues
				.map((issue) => `- ${issue}`)
				.join("\n")}`,
		);
		this.name = "CorruptedReviewItemRowError";
		this.issues = issues;
	}
}

const requiredDate = (value: string, column: string, id: string): Date => {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		throw new CorruptedReviewItemRowError(id, [
			`${column} must be a valid ISO timestamp`,
		]);
	}

	return date;
};

const optionalDate = (
	value: string | null,
	column: string,
	id: string,
): Date | undefined =>
	value === null ? undefined : requiredDate(value, column, id);

export function toReviewItem(row: ReviewItemRow): ReviewItem {
	const state = row.state;

	if (!isReviewItemState(state)) {
		throw new CorruptedReviewItemRowError(row.id, [
			`state "${state}" is not a supported review item state`,
		]);
	}

	return restoreReviewItem({
		id: toReviewItemId(row.id),
		questionId: toQuestionId(row.questionId),
		telegramUserId: row.telegramUserId,
		state,
		streak: row.streak,
		dueAt: requiredDate(row.dueAt, "due_at", row.id),
		createdAt: requiredDate(row.createdAt, "created_at", row.id),
		lastReviewedAt: optionalDate(
			row.lastReviewedAt,
			"last_reviewed_at",
			row.id,
		),
	});
}

export function toReviewItemRow(item: ReviewItem): ReviewItemInsert {
	return {
		id: item.id,
		questionId: item.questionId,
		telegramUserId: item.telegramUserId,
		state: item.state,
		streak: item.streak,
		dueAt: item.dueAt.toISOString(),
		createdAt: item.createdAt.toISOString(),
		lastReviewedAt: item.lastReviewedAt?.toISOString() ?? null,
	};
}
