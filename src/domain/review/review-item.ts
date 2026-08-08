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

interface ReviewItemSnapshot {
	readonly id: ReviewItemId;
	readonly questionId: QuestionId;
	readonly telegramUserId: number;
	readonly state: ReviewItemState;
	readonly streak: number;
	readonly dueAt: Date;
	readonly createdAt: Date;
	readonly lastReviewedAt?: Date;
}

const collectStreakIssues = (
	snapshot: ReviewItemSnapshot,
): readonly string[] => {
	if (!Number.isSafeInteger(snapshot.streak) || snapshot.streak < 0) {
		return ["streak must be a non-negative integer"];
	}

	if (snapshot.streak > RETIREMENT_STREAK) {
		return [`streak must not exceed ${RETIREMENT_STREAK}`];
	}

	if (snapshot.state === ReviewItemState.Retired) {
		return snapshot.streak === RETIREMENT_STREAK
			? []
			: [`a retired item must have a streak of ${RETIREMENT_STREAK}`];
	}

	if (snapshot.streak === RETIREMENT_STREAK) {
		return [`only a retired item may have a streak of ${RETIREMENT_STREAK}`];
	}

	if (snapshot.state === ReviewItemState.Pending && snapshot.streak !== 0) {
		return ["a pending item must have a streak of 0"];
	}

	if (snapshot.state === ReviewItemState.Learning && snapshot.streak < 1) {
		return ["a learning item must have a streak of at least 1"];
	}

	return [];
};

const collectSnapshotDateIssues = (
	snapshot: ReviewItemSnapshot,
): readonly string[] => {
	const issues: string[] = [];
	const hasValidCreatedAt = isValidDate(snapshot.createdAt);

	if (!hasValidCreatedAt) {
		issues.push("createdAt must be a valid date");
	}

	if (!isValidDate(snapshot.dueAt)) {
		issues.push("dueAt must be a valid date");
	} else if (
		hasValidCreatedAt &&
		snapshot.dueAt.getTime() < snapshot.createdAt.getTime()
	) {
		issues.push("dueAt must not precede createdAt");
	}

	if (snapshot.lastReviewedAt === undefined) {
		return issues;
	}

	if (!isValidDate(snapshot.lastReviewedAt)) {
		issues.push("lastReviewedAt must be a valid date");
	} else if (
		hasValidCreatedAt &&
		snapshot.lastReviewedAt.getTime() < snapshot.createdAt.getTime()
	) {
		// The mark functions anchor monotonicity on both createdAt and
		// lastReviewedAt, so an item whose review predates its creation contradicts
		// itself and would reject every later review.
		issues.push("lastReviewedAt must not precede createdAt");
	}

	return issues;
};

/**
 * Rebuilds a persisted review item. `streak` integrity is otherwise a property
 * of construction alone — a literal can retire without earning it, or carry a
 * streak the public API can never reach — so every invariant the transitions
 * maintain is re-checked here at the storage boundary.
 */
export function restoreReviewItem(snapshot: ReviewItemSnapshot): ReviewItem {
	const issues: string[] = [];

	if (!isReviewItemState(snapshot.state)) {
		issues.push("state must be a supported review item state");
	} else {
		issues.push(...collectStreakIssues(snapshot));
	}

	if (
		!Number.isSafeInteger(snapshot.telegramUserId) ||
		snapshot.telegramUserId <= 0
	) {
		issues.push("telegramUserId must be a positive integer");
	}

	issues.push(...collectSnapshotDateIssues(snapshot));

	if (issues.length > 0) {
		throw new ReviewItemValidationError(issues);
	}

	return frozenReviewItem({
		id: snapshot.id,
		questionId: snapshot.questionId,
		telegramUserId: snapshot.telegramUserId,
		state: snapshot.state,
		streak: snapshot.streak,
		dueAt: snapshot.dueAt,
		createdAt: snapshot.createdAt,
		lastReviewedAt: snapshot.lastReviewedAt,
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

/**
 * Moves an item's next due date without touching its streak. Used when the user
 * rates a review they have already answered, so the rating adjusts the schedule
 * rather than re-scoring the answer.
 */
export function rescheduleReview(item: ReviewItem, dueAt: Date): ReviewItem {
	const anchor = item.lastReviewedAt ?? item.createdAt;
	const issues: string[] = [];

	if (!isValidDate(dueAt)) {
		issues.push("dueAt must be a valid date");
	} else if (dueAt.getTime() < anchor.getTime()) {
		issues.push("dueAt must not precede the last review");
	}

	if (issues.length > 0) {
		throw new ReviewItemValidationError(issues);
	}

	return frozenReviewItem({ ...item, dueAt });
}

/**
 * Puts a retired question back into rotation after it is answered wrong again.
 * Retirement means "learned", not "never ask again" — without this the item
 * would be stuck and the mistake silently dropped.
 */
export function reopenReviewItem(
	item: ReviewItem,
	at: Date,
	dueAt: Date,
): ReviewItem {
	assertReviewDates(item, at, dueAt);

	return frozenReviewItem({
		...item,
		state: ReviewItemState.Pending,
		streak: 0,
		dueAt,
		lastReviewedAt: at,
	});
}
