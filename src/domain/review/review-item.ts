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

/** A correct repetition streak of this length retires the item. */
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

/**
 * `Date` is mutable, so a stored reference would let a caller change a frozen
 * item's timestamps from the outside. Every timestamp is copied on the way in;
 * reference identity is deliberately not part of the contract.
 */
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

	if (!isValidDate(draft.createdAt)) {
		issues.push("createdAt must be a valid date");
	}

	if (!isValidDate(draft.dueAt)) {
		issues.push("dueAt must be a valid date");
	}

	return issues;
};

const assertReviewable = (item: ReviewItem): void => {
	if (item.state === ReviewItemState.Retired) {
		throw new RetiredReviewItemError();
	}
};

/**
 * An invalid or backdated review timestamp would silently corrupt the review
 * timeline, so both dates are checked before the item is touched. Validity is
 * checked before monotonicity, because comparing an invalid date yields a
 * meaningless verdict. An `at` equal to `createdAt` and a `dueAt` equal to `at`
 * are both valid; a `dueAt` before `at` would schedule a repetition before the
 * review that produced it.
 */
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

	if (dueAt.getTime() < at.getTime()) {
		order.push("dueAt must not precede at");
	}

	if (order.length > 0) {
		throw new ReviewItemValidationError(order);
	}
};

/** Validates every invariant and reports all issues at once. */
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

/** A wrong answer resets progress and makes the item due again. */
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

/**
 * A correct repetition advances the streak; the interval behind `dueAt` is the
 * caller's decision, because scheduling policy lives outside the domain.
 */
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
