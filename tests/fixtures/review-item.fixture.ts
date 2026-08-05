import { toQuestionId } from "@/domain/quiz-set/question";
import {
	createReviewItem,
	type ReviewItem,
	toReviewItemId,
} from "@/domain/review/review-item";

interface ReviewItemOverrides {
	readonly id?: string;
	readonly questionId?: string;
	readonly telegramUserId?: number;
	readonly createdAt?: Date;
	readonly dueAt?: Date;
}

export function aReviewItem(overrides: ReviewItemOverrides = {}): ReviewItem {
	const questionId = overrides.questionId ?? "question-1";

	return createReviewItem({
		id: toReviewItemId(overrides.id ?? `review-${questionId}`),
		questionId: toQuestionId(questionId),
		telegramUserId: overrides.telegramUserId ?? 42,
		createdAt: overrides.createdAt ?? new Date("2026-08-01T00:00:00.000Z"),
		dueAt: overrides.dueAt ?? new Date("2026-08-02T00:00:00.000Z"),
	});
}
