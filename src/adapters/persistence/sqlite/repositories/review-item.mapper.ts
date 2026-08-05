import { toQuestionId } from "@/domain/quiz-set/question";
import {
	isReviewItemState,
	type ReviewItem,
	restoreReviewItem,
	toReviewItemId,
} from "@/domain/review/review-item";

export interface ReviewItemRow {
	readonly id: string;
	readonly question_id: string;
	readonly telegram_user_id: number;
	readonly state: string;
	readonly streak: number;
	readonly due_at: string;
	readonly created_at: string;
	readonly last_reviewed_at: string | null;
}

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
		questionId: toQuestionId(row.question_id),
		telegramUserId: row.telegram_user_id,
		state,
		streak: row.streak,
		dueAt: requiredDate(row.due_at, "due_at", row.id),
		createdAt: requiredDate(row.created_at, "created_at", row.id),
		lastReviewedAt: optionalDate(
			row.last_reviewed_at,
			"last_reviewed_at",
			row.id,
		),
	});
}

export function toReviewItemRow(item: ReviewItem): ReviewItemRow {
	return {
		id: item.id,
		question_id: item.questionId,
		telegram_user_id: item.telegramUserId,
		state: item.state,
		streak: item.streak,
		due_at: item.dueAt.toISOString(),
		created_at: item.createdAt.toISOString(),
		last_reviewed_at: item.lastReviewedAt?.toISOString() ?? null,
	};
}
