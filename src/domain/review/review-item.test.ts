import { describe, expect, test } from "bun:test";
import { toQuestionId } from "../quiz-set/question";
import {
	RetiredReviewItemError,
	ReviewItemValidationError,
} from "./review.errors";
import {
	createReviewItem,
	isReviewItemState,
	markReviewFailed,
	markReviewPassed,
	RETIREMENT_STREAK,
	type ReviewItem,
	ReviewItemState,
	restoreReviewItem,
	toReviewItemId,
} from "./review-item";

const createdAt = new Date("2026-08-01T10:00:00.000Z");
const dueAt = new Date("2026-08-02T10:00:00.000Z");
const reviewedAt = new Date("2026-08-02T11:00:00.000Z");
const nextDueAt = new Date("2026-08-05T11:00:00.000Z");
const laterReviewedAt = new Date("2026-08-06T11:00:00.000Z");
const laterDueAt = new Date("2026-08-09T11:00:00.000Z");
const staleAt = new Date("2026-08-01T12:00:00.000Z");
const earlierAt = new Date("2026-07-31T10:00:00.000Z");
const invalidDate = new Date("not a date");

const questionId = toQuestionId("question-1");

const validDraft = {
	id: toReviewItemId("review-item-1"),
	questionId,
	telegramUserId: 42,
	createdAt,
	dueAt,
};

type ReviewItemDraft = Parameters<typeof createReviewItem>[0];
type MarkReview = (item: ReviewItem, at: Date, dueAt: Date) => ReviewItem;

const markFunctions = [
	["markReviewFailed", markReviewFailed],
	["markReviewPassed", markReviewPassed],
] as const;

const issuesOf = (draft: ReviewItemDraft): readonly string[] => {
	try {
		createReviewItem(draft);
	} catch (caught) {
		expect(caught).toBeInstanceOf(ReviewItemValidationError);

		return (caught as ReviewItemValidationError).issues;
	}

	throw new Error("expected createReviewItem to throw");
};

const markIssuesOf = (
	mark: MarkReview,
	item: ReviewItem,
	at: Date,
	nextDue: Date,
): readonly string[] => {
	try {
		mark(item, at, nextDue);
	} catch (caught) {
		expect(caught).toBeInstanceOf(ReviewItemValidationError);

		return (caught as ReviewItemValidationError).issues;
	}

	throw new Error("expected the review transition to throw");
};

const pendingItem = (): ReviewItem => createReviewItem(validDraft);

const withStreak = (streak: number): ReviewItem => {
	let item = pendingItem();

	for (let index = 0; index < streak; index += 1) {
		item = markReviewPassed(item, reviewedAt, nextDueAt);
	}

	return item;
};

const reviewedOnce = (): ReviewItem =>
	markReviewPassed(pendingItem(), reviewedAt, nextDueAt);

describe("ReviewItem", () => {
	describe("isReviewItemState", () => {
		test.each(Object.values(ReviewItemState))("accepts %p", (value) => {
			expect(isReviewItemState(value)).toBe(true);
		});

		test.each([
			"suspended",
			"",
			"Pending",
			undefined,
			null,
			0,
			1,
			{},
			[["pending"]],
		])("rejects %p", (value) => {
			expect(isReviewItemState(value)).toBe(false);
		});
	});

	describe("createReviewItem", () => {
		test("starts pending with a zero streak", () => {
			const item = pendingItem();

			expect(item.id).toBe(validDraft.id);
			expect(item.questionId).toBe(questionId);
			expect(item.telegramUserId).toBe(42);
			expect(item.state).toBe(ReviewItemState.Pending);
			expect(item.streak).toBe(0);
			expect(item.createdAt).toEqual(createdAt);
			expect(item.dueAt).toEqual(dueAt);
			expect(item.lastReviewedAt).toBeUndefined();
		});

		test("returns a frozen item", () => {
			expect(Object.isFrozen(pendingItem())).toBe(true);
		});

		test("copies the dates so later mutation cannot reach the item", () => {
			const mutableCreatedAt = new Date(createdAt.getTime());
			const mutableDueAt = new Date(dueAt.getTime());
			const item = createReviewItem({
				...validDraft,
				createdAt: mutableCreatedAt,
				dueAt: mutableDueAt,
			});

			mutableCreatedAt.setFullYear(1999);
			mutableDueAt.setFullYear(1999);

			expect(item.createdAt).toEqual(createdAt);
			expect(item.dueAt).toEqual(dueAt);
		});

		test.each([
			0,
			-1,
			1.5,
			Number.NaN,
			Number.MAX_SAFE_INTEGER + 2,
		])("rejects the telegramUserId %p", (telegramUserId) => {
			expect(issuesOf({ ...validDraft, telegramUserId })).toEqual([
				"telegramUserId must be a positive integer",
			]);
		});

		test("rejects an invalid createdAt", () => {
			expect(issuesOf({ ...validDraft, createdAt: invalidDate })).toEqual([
				"createdAt must be a valid date",
			]);
		});

		test("rejects an invalid dueAt", () => {
			expect(issuesOf({ ...validDraft, dueAt: invalidDate })).toEqual([
				"dueAt must be a valid date",
			]);
		});

		test("rejects a dueAt that precedes createdAt", () => {
			expect(issuesOf({ ...validDraft, dueAt: earlierAt })).toEqual([
				"dueAt must not precede createdAt",
			]);
		});

		test("accepts a dueAt equal to createdAt", () => {
			expect(
				createReviewItem({ ...validDraft, dueAt: createdAt }).dueAt,
			).toEqual(createdAt);
		});

		test("reports every issue at once in the documented order", () => {
			expect(
				issuesOf({
					...validDraft,
					telegramUserId: 0,
					createdAt: invalidDate,
					dueAt: invalidDate,
				}),
			).toEqual([
				"telegramUserId must be a positive integer",
				"createdAt must be a valid date",
				"dueAt must be a valid date",
			]);
		});

		test("reports the user id and the due date order together", () => {
			expect(
				issuesOf({ ...validDraft, telegramUserId: 0, dueAt: earlierAt }),
			).toEqual([
				"telegramUserId must be a positive integer",
				"dueAt must not precede createdAt",
			]);
		});

		test("does not compare the dates until both are valid", () => {
			expect(
				issuesOf({ ...validDraft, createdAt: invalidDate, dueAt: earlierAt }),
			).toEqual(["createdAt must be a valid date"]);
		});

		test("names every issue in the error message", () => {
			expect(() =>
				createReviewItem({ ...validDraft, telegramUserId: 0 }),
			).toThrow(
				"Invalid review item:\n- telegramUserId must be a positive integer",
			);
		});
	});

	describe("markReviewFailed", () => {
		test("resets the streak and makes the item pending again", () => {
			const learning = withStreak(RETIREMENT_STREAK - 1);

			expect(learning.state).toBe(ReviewItemState.Learning);
			expect(learning.streak).toBe(RETIREMENT_STREAK - 1);

			const failed = markReviewFailed(learning, reviewedAt, nextDueAt);

			expect(failed.state).toBe(ReviewItemState.Pending);
			expect(failed.streak).toBe(0);
			expect(failed.lastReviewedAt).toEqual(reviewedAt);
			expect(failed.dueAt).toEqual(nextDueAt);
		});

		test("never drives the streak negative", () => {
			expect(
				markReviewFailed(pendingItem(), reviewedAt, nextDueAt).streak,
			).toBe(0);
		});

		test("does not mutate the input item", () => {
			const learning = withStreak(2);

			markReviewFailed(learning, reviewedAt, nextDueAt);

			expect(learning.state).toBe(ReviewItemState.Learning);
			expect(learning.streak).toBe(2);
			expect(learning.dueAt).toEqual(nextDueAt);
		});

		test("returns a frozen item", () => {
			expect(
				Object.isFrozen(markReviewFailed(pendingItem(), reviewedAt, nextDueAt)),
			).toBe(true);
		});

		test("copies the dates so later mutation cannot reach the item", () => {
			const mutableAt = new Date(reviewedAt.getTime());
			const mutableDueAt = new Date(nextDueAt.getTime());
			const failed = markReviewFailed(pendingItem(), mutableAt, mutableDueAt);

			mutableAt.setFullYear(1999);
			mutableDueAt.setFullYear(1999);

			expect(failed.lastReviewedAt).toEqual(reviewedAt);
			expect(failed.dueAt).toEqual(nextDueAt);
		});
	});

	describe("markReviewPassed", () => {
		test("advances the streak into learning", () => {
			const passed = reviewedOnce();

			expect(passed.state).toBe(ReviewItemState.Learning);
			expect(passed.streak).toBe(1);
			expect(passed.lastReviewedAt).toEqual(reviewedAt);
			expect(passed.dueAt).toEqual(nextDueAt);
		});

		test("stays learning below the retirement streak", () => {
			const passed = withStreak(RETIREMENT_STREAK - 1);

			expect(passed.streak).toBe(RETIREMENT_STREAK - 1);
			expect(passed.state).toBe(ReviewItemState.Learning);
		});

		test("retires the item once the streak reaches RETIREMENT_STREAK", () => {
			const retired = withStreak(RETIREMENT_STREAK);

			expect(retired.streak).toBe(RETIREMENT_STREAK);
			expect(retired.state).toBe(ReviewItemState.Retired);
		});

		test("does not mutate the input item", () => {
			const item = pendingItem();

			markReviewPassed(item, reviewedAt, nextDueAt);

			expect(item.state).toBe(ReviewItemState.Pending);
			expect(item.streak).toBe(0);
			expect(item.lastReviewedAt).toBeUndefined();
			expect(item.dueAt).toEqual(dueAt);
		});

		test("returns a frozen item", () => {
			expect(Object.isFrozen(reviewedOnce())).toBe(true);
		});

		test("copies the dates so later mutation cannot reach the item", () => {
			const mutableAt = new Date(reviewedAt.getTime());
			const mutableDueAt = new Date(nextDueAt.getTime());
			const passed = markReviewPassed(pendingItem(), mutableAt, mutableDueAt);

			mutableAt.setFullYear(1999);
			mutableDueAt.setFullYear(1999);

			expect(passed.lastReviewedAt).toEqual(reviewedAt);
			expect(passed.dueAt).toEqual(nextDueAt);
		});
	});

	describe("retired items", () => {
		test.each(markFunctions)("%s rejects a retired item", (_name, mark) => {
			const retired = withStreak(RETIREMENT_STREAK);

			expect(() => mark(retired, laterReviewedAt, laterDueAt)).toThrow(
				RetiredReviewItemError,
			);
			expect(() => mark(retired, laterReviewedAt, laterDueAt)).toThrow(
				"A retired review item cannot be reviewed again",
			);
		});

		test.each(
			markFunctions,
		)("%s reports retirement before an invalid date", (_name, mark) => {
			const retired = withStreak(RETIREMENT_STREAK);

			expect(() => mark(retired, invalidDate, invalidDate)).toThrow(
				RetiredReviewItemError,
			);
		});
	});

	describe("review dates", () => {
		test.each(markFunctions)("%s rejects an invalid at", (_name, mark) => {
			expect(markIssuesOf(mark, pendingItem(), invalidDate, nextDueAt)).toEqual(
				["at must be a valid date"],
			);
		});

		test.each(markFunctions)("%s rejects an invalid dueAt", (_name, mark) => {
			expect(
				markIssuesOf(mark, pendingItem(), reviewedAt, invalidDate),
			).toEqual(["dueAt must be a valid date"]);
		});

		test.each(
			markFunctions,
		)("%s reports both invalid dates at once", (_name, mark) => {
			expect(
				markIssuesOf(mark, pendingItem(), invalidDate, invalidDate),
			).toEqual(["at must be a valid date", "dueAt must be a valid date"]);
		});

		test.each(
			markFunctions,
		)("%s does not compare the dates until both are valid", (_name, mark) => {
			expect(markIssuesOf(mark, pendingItem(), earlierAt, invalidDate)).toEqual(
				["dueAt must be a valid date"],
			);
		});

		test.each(
			markFunctions,
		)("%s rejects an at before createdAt", (_name, mark) => {
			expect(markIssuesOf(mark, pendingItem(), earlierAt, nextDueAt)).toEqual([
				"at must not precede createdAt",
			]);
		});

		test.each(
			markFunctions,
		)("%s accepts an at equal to createdAt", (_name, mark) => {
			expect(mark(pendingItem(), createdAt, nextDueAt).lastReviewedAt).toEqual(
				createdAt,
			);
		});

		test.each(markFunctions)("%s rejects a dueAt before at", (_name, mark) => {
			expect(markIssuesOf(mark, pendingItem(), reviewedAt, createdAt)).toEqual([
				"dueAt must not precede at",
			]);
		});

		test.each(
			markFunctions,
		)("%s accepts a dueAt equal to at", (_name, mark) => {
			expect(mark(pendingItem(), reviewedAt, reviewedAt).dueAt).toEqual(
				reviewedAt,
			);
		});

		test.each(
			markFunctions,
		)("%s reports a lone order violation once and lets validity suppress it", (_name, mark) => {
			expect(markIssuesOf(mark, pendingItem(), earlierAt, earlierAt)).toEqual([
				"at must not precede createdAt",
			]);
			expect(markIssuesOf(mark, pendingItem(), earlierAt, invalidDate)).toEqual(
				["dueAt must be a valid date"],
			);
		});

		test.each(
			markFunctions,
		)("%s rejects an at before lastReviewedAt", (_name, mark) => {
			expect(markIssuesOf(mark, reviewedOnce(), staleAt, nextDueAt)).toEqual([
				"at must not precede lastReviewedAt",
			]);
		});

		test.each(
			markFunctions,
		)("%s accepts an at equal to lastReviewedAt", (_name, mark) => {
			expect(
				mark(reviewedOnce(), reviewedAt, nextDueAt).lastReviewedAt,
			).toEqual(reviewedAt);
		});

		test.each(
			markFunctions,
		)("%s accepts a strictly later second review", (_name, mark) => {
			const again = mark(reviewedOnce(), laterReviewedAt, laterDueAt);

			expect(again.lastReviewedAt).toEqual(laterReviewedAt);
			expect(again.dueAt).toEqual(laterDueAt);
		});

		test.each(
			markFunctions,
		)("%s reports every monotonicity issue at once", (_name, mark) => {
			expect(markIssuesOf(mark, reviewedOnce(), earlierAt, earlierAt)).toEqual([
				"at must not precede createdAt",
				"at must not precede lastReviewedAt",
			]);
			expect(markIssuesOf(mark, reviewedOnce(), staleAt, earlierAt)).toEqual([
				"at must not precede lastReviewedAt",
				"dueAt must not precede at",
			]);
		});

		test.each(markFunctions)("%s preserves createdAt", (_name, mark) => {
			expect(mark(pendingItem(), reviewedAt, nextDueAt).createdAt).toEqual(
				createdAt,
			);
		});
	});

	describe("restoreReviewItem", () => {
		type ReviewItemSnapshot = Parameters<typeof restoreReviewItem>[0];

		const snapshotOf = (item: ReviewItem): ReviewItemSnapshot => ({
			id: item.id,
			questionId: item.questionId,
			telegramUserId: item.telegramUserId,
			state: item.state,
			streak: item.streak,
			dueAt: item.dueAt,
			createdAt: item.createdAt,
			lastReviewedAt: item.lastReviewedAt,
		});

		const snapshot = (
			overrides: Partial<ReviewItemSnapshot> = {},
		): ReviewItemSnapshot => ({
			...snapshotOf(pendingItem()),
			...overrides,
		});

		const restoreIssues = (
			candidate: ReviewItemSnapshot,
		): readonly string[] => {
			try {
				restoreReviewItem(candidate);
			} catch (caught) {
				expect(caught).toBeInstanceOf(ReviewItemValidationError);

				return (caught as ReviewItemValidationError).issues;
			}

			throw new Error("expected restoreReviewItem to throw");
		};

		const learningItem = (): ReviewItem =>
			markReviewPassed(pendingItem(), reviewedAt, nextDueAt);

		const retiredItem = (): ReviewItem => {
			let item = pendingItem();

			for (let pass = 0; pass < RETIREMENT_STREAK; pass += 1) {
				item = markReviewPassed(item, reviewedAt, nextDueAt);
			}

			return item;
		};

		test.each([
			["pending", pendingItem],
			["learning", learningItem],
			["retired", retiredItem],
		])("restores a %s item the transitions produce", (_name, build) => {
			const expected = build();

			expect(restoreReviewItem(snapshotOf(expected))).toEqual(expected);
		});

		test("copies dates and freezes the restored item", () => {
			const source = snapshot();
			const restored = restoreReviewItem(source);

			source.createdAt.setFullYear(1999);

			expect(restored.createdAt).toEqual(createdAt);
			expect(Object.isFrozen(restored)).toBe(true);
		});

		test("rejects an unsupported state", () => {
			expect(
				restoreIssues(snapshot({ state: "archived" as ReviewItemState })),
			).toContain("state must be a supported review item state");
		});

		test.each([-1, 1.5, Number.NaN])("rejects the streak %p", (streak) => {
			expect(restoreIssues(snapshot({ streak }))).toContain(
				"streak must be a non-negative integer",
			);
		});

		test("rejects a streak above the retirement threshold", () => {
			expect(
				restoreIssues(
					snapshot({
						state: ReviewItemState.Retired,
						streak: RETIREMENT_STREAK + 1,
						lastReviewedAt: reviewedAt,
					}),
				),
			).toContain(`streak must not exceed ${RETIREMENT_STREAK}`);
		});

		test("rejects a retired item that never earned retirement", () => {
			expect(
				restoreIssues(snapshot({ state: ReviewItemState.Retired, streak: 0 })),
			).toContain(`a retired item must have a streak of ${RETIREMENT_STREAK}`);
		});

		test("rejects a non-retired item that reached the threshold", () => {
			expect(
				restoreIssues(
					snapshot({
						state: ReviewItemState.Learning,
						streak: RETIREMENT_STREAK,
						lastReviewedAt: reviewedAt,
					}),
				),
			).toContain(
				`only a retired item may have a streak of ${RETIREMENT_STREAK}`,
			);
		});

		test("rejects a pending item with a streak", () => {
			expect(
				restoreIssues(snapshot({ streak: 1, lastReviewedAt: reviewedAt })),
			).toContain("a pending item must have a streak of 0");
		});

		test("rejects a learning item without a streak", () => {
			expect(
				restoreIssues(
					snapshot({
						state: ReviewItemState.Learning,
						streak: 0,
						lastReviewedAt: reviewedAt,
					}),
				),
			).toContain("a learning item must have a streak of at least 1");
		});

		test("rejects a non-positive telegram user id", () => {
			expect(restoreIssues(snapshot({ telegramUserId: 0 }))).toContain(
				"telegramUserId must be a positive integer",
			);
		});

		test("rejects invalid dates", () => {
			expect(restoreIssues(snapshot({ createdAt: invalidDate }))).toContain(
				"createdAt must be a valid date",
			);
			expect(restoreIssues(snapshot({ dueAt: invalidDate }))).toContain(
				"dueAt must be a valid date",
			);
			expect(
				restoreIssues(snapshot({ lastReviewedAt: invalidDate })),
			).toContain("lastReviewedAt must be a valid date");
		});

		test("rejects a dueAt that precedes createdAt", () => {
			expect(restoreIssues(snapshot({ dueAt: earlierAt }))).toContain(
				"dueAt must not precede createdAt",
			);
		});

		// A lastReviewedAt before createdAt makes the two monotonicity checks in
		// assertReviewDates contradict each other, so the item would reject every
		// later review.
		test("rejects a lastReviewedAt that precedes createdAt", () => {
			expect(restoreIssues(snapshot({ lastReviewedAt: earlierAt }))).toContain(
				"lastReviewedAt must not precede createdAt",
			);
		});

		test("accepts a reviewable restored item", () => {
			const restored = restoreReviewItem(snapshotOf(learningItem()));

			expect(
				markReviewPassed(restored, laterReviewedAt, laterDueAt).streak,
			).toBe(2);
		});
	});
});
