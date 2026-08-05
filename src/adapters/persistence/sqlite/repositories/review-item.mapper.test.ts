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
	question_id: "question-1",
	telegram_user_id: 42,
	state: ReviewItemState.Pending,
	streak: 0,
	due_at: "2026-08-02T00:00:00.000Z",
	created_at: "2026-08-01T00:00:00.000Z",
	last_reviewed_at: null,
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
			toReviewItem(aReviewItemRow({ created_at: "nonsense" })),
		).toThrow(CorruptedReviewItemRowError);
		expect(() => toReviewItem(aReviewItemRow({ due_at: "nonsense" }))).toThrow(
			CorruptedReviewItemRowError,
		);
		expect(() =>
			toReviewItem(aReviewItemRow({ last_reviewed_at: "nonsense" })),
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
					last_reviewed_at: "2026-07-01T00:00:00.000Z",
				}),
			),
		).toThrow(ReviewItemValidationError);
	});
});
