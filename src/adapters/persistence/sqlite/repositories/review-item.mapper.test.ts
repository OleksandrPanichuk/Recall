import { describe, expect, test } from "bun:test";
import { ReviewItemValidationError } from "@/domain/review/review.errors";
import {
	RETIREMENT_STREAK,
	ReviewItemState,
} from "@/domain/review/review-item";
import {
	CorruptedReviewItemRowError,
	type ReviewItemRow,
	toReviewItem,
} from "./review-item.mapper";

// The database constrains state and keeps streak non-negative, so these guards
// are only reachable at the mapper. They are exercised here instead.
const aReviewItemRow = (
	overrides: Partial<ReviewItemRow> = {},
): ReviewItemRow => ({
	id: "review-1",
	questionId: "question-1",
	telegramUserId: 42,
	state: ReviewItemState.Pending,
	streak: 0,
	dueAt: "2026-08-02T00:00:00.000Z",
	createdAt: "2026-08-01T00:00:00.000Z",
	lastReviewedAt: null,
	...overrides,
});

describe("review item mapper", () => {
	test("restores a pending item", () => {
		const item = toReviewItem(aReviewItemRow());

		expect(item.state).toBe(ReviewItemState.Pending);
		expect(item.lastReviewedAt).toBeUndefined();
	});

	test("rejects an unsupported state", () => {
		expect(() => toReviewItem(aReviewItemRow({ state: "archived" }))).toThrow(
			CorruptedReviewItemRowError,
		);
	});

	test("rejects unparsable timestamps", () => {
		expect(() =>
			toReviewItem(aReviewItemRow({ createdAt: "nonsense" })),
		).toThrow(CorruptedReviewItemRowError);
		expect(() => toReviewItem(aReviewItemRow({ dueAt: "nonsense" }))).toThrow(
			CorruptedReviewItemRowError,
		);
		expect(() =>
			toReviewItem(aReviewItemRow({ lastReviewedAt: "nonsense" })),
		).toThrow(CorruptedReviewItemRowError);
	});

	test("rejects a retirement that was never earned", () => {
		expect(() =>
			toReviewItem(
				aReviewItemRow({ state: ReviewItemState.Retired, streak: 0 }),
			),
		).toThrow(ReviewItemValidationError);
	});

	test("rejects a streak the transitions can never reach", () => {
		expect(() =>
			toReviewItem(
				aReviewItemRow({
					state: ReviewItemState.Retired,
					streak: RETIREMENT_STREAK + 1,
				}),
			),
		).toThrow(ReviewItemValidationError);
	});

	test("rejects a review recorded before the item existed", () => {
		expect(() =>
			toReviewItem(
				aReviewItemRow({
					state: ReviewItemState.Learning,
					streak: 1,
					lastReviewedAt: "2026-07-01T00:00:00.000Z",
				}),
			),
		).toThrow(ReviewItemValidationError);
	});
});
