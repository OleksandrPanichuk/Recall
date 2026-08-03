import { type BrandedId, brandedId } from "../branded-id";
import type { QuestionId } from "../quiz-set/question";
import {
	RetiredReviewItemError,
	ReviewItemValidationError,
} from "./review.errors";

export type ReviewItemId = BrandedId<"ReviewItemId">;

export const toReviewItemId = (value: string): ReviewItemId =>
	brandedId<"ReviewItemId">(value, "ReviewItemId");

export const ReviewItemState = {
	Pending: "pending",
	Learning: "learning",
	Retired: "retired",
} as const;
export type ReviewItemState =
	(typeof ReviewItemState)[keyof typeof ReviewItemState];

export function isReviewItemState(value: unknown): value is ReviewItemState {
	return (Object.values(ReviewItemState) as readonly unknown[]).includes(value);
}

export const RETIREMENT_STREAK = 4;

export interface ReviewItem {
	readonly id: ReviewItemId;
	readonly questionId: QuestionId;
	readonly telegramUserId: number;
	readonly state: ReviewItemState;
	readonly streak: number;
	readonly dueAt: Date;
	readonly createdAt: Date;
	readonly lastReviewedAt?: Date;
}

interface ReviewItemDraft {
	readonly id: ReviewItemId;
	readonly questionId: QuestionId;
	readonly telegramUserId: number;
	readonly createdAt: Date;
	readonly dueAt: Date;
}

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

const copiedDate = (value: Date): Date => new Date(value.getTime());

const copiedOptionalDate = (value: Date | undefined): Date | undefined =>
	value === undefined ? undefined : copiedDate(value);

const frozenReviewItem = (fields: ReviewItem): ReviewItem =>
	Object.freeze({
		...fields,
		dueAt: copiedDate(fields.dueAt),
		createdAt: copiedDate(fields.createdAt),
		lastReviewedAt: copiedOptionalDate(fields.lastReviewedAt),
	});

const collectDraftIssues = (draft: ReviewItemDraft): readonly string[] => {
	const issues: string[] = [];

	if (
		!Number.isSafeInteger(draft.telegramUserId) ||
		draft.telegramUserId <= 0
	) {
		issues.push("telegramUserId must be a positive integer");
	}

	const hasValidCreatedAt = isValidDate(draft.createdAt);
	const hasValidDueAt = isValidDate(draft.dueAt);

	if (!hasValidCreatedAt) {
		issues.push("createdAt must be a valid date");
	}

	if (!hasValidDueAt) {
		issues.push("dueAt must be a valid date");
	}

	if (
		hasValidCreatedAt &&
		hasValidDueAt &&
		draft.dueAt.getTime() < draft.createdAt.getTime()
	) {
		issues.push("dueAt must not precede createdAt");
	}

	return issues;
};

const assertReviewable = (item: ReviewItem): void => {
	if (item.state === ReviewItemState.Retired) {
		throw new RetiredReviewItemError();
	}
};

const assertReviewDates = (item: ReviewItem, at: Date, dueAt: Date): void => {
	const validity: string[] = [];

	if (!isValidDate(at)) {
		validity.push("at must be a valid date");
	}

	if (!isValidDate(dueAt)) {
		validity.push("dueAt must be a valid date");
	}

	if (validity.length > 0) {
		throw new ReviewItemValidationError(validity);
	}

	const order: string[] = [];

	if (at.getTime() < item.createdAt.getTime()) {
		order.push("at must not precede createdAt");
	}

	if (
		item.lastReviewedAt !== undefined &&
		at.getTime() < item.lastReviewedAt.getTime()
	) {
		order.push("at must not precede lastReviewedAt");
	}

	if (dueAt.getTime() < at.getTime()) {
		order.push("dueAt must not precede at");
	}

	if (order.length > 0) {
		throw new ReviewItemValidationError(order);
	}
};

export function createReviewItem(draft: ReviewItemDraft): ReviewItem {
	const issues = collectDraftIssues(draft);

	if (issues.length > 0) {
		throw new ReviewItemValidationError(issues);
	}

	return frozenReviewItem({
		id: draft.id,
		questionId: draft.questionId,
		telegramUserId: draft.telegramUserId,
		state: ReviewItemState.Pending,
		streak: 0,
		dueAt: draft.dueAt,
		createdAt: draft.createdAt,
	});
}

export function markReviewFailed(
	item: ReviewItem,
	at: Date,
	dueAt: Date,
): ReviewItem {
	assertReviewable(item);
	assertReviewDates(item, at, dueAt);

	return frozenReviewItem({
		...item,
		state: ReviewItemState.Pending,
		streak: 0,
		dueAt,
		lastReviewedAt: at,
	});
}

export function markReviewPassed(
	item: ReviewItem,
	at: Date,
	dueAt: Date,
): ReviewItem {
	assertReviewable(item);
	assertReviewDates(item, at, dueAt);

	const streak = item.streak + 1;

	return frozenReviewItem({
		...item,
		state:
			streak >= RETIREMENT_STREAK
				? ReviewItemState.Retired
				: ReviewItemState.Learning,
		streak,
		dueAt,
		lastReviewedAt: at,
	});
}
