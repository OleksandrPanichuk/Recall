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
	toReviewItemId,
} from "./review-item";

const createdAt = new Date("2026-08-01T10:00:00.000Z");
const dueAt = new Date("2026-08-02T10:00:00.000Z");
const reviewedAt = new Date("2026-08-02T11:00:00.000Z");
const nextDueAt = new Date("2026-08-05T11:00:00.000Z");
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

const issuesOf = (draft: ReviewItemDraft): readonly string[] => {
	try {
		createReviewItem(draft);
	} catch (caught) {
		expect(caught).toBeInstanceOf(ReviewItemValidationError);

		return (caught as ReviewItemValidationError).issues;
	}

	throw new Error("expected createReviewItem to throw");
};

const pendingItem = (): ReviewItem => createReviewItem(validDraft);

/** Advances an item to the given streak through successful repetitions. */
const withStreak = (streak: number): ReviewItem => {
	let item = pendingItem();

	for (let index = 0; index < streak; index += 1) {
		item = markReviewPassed(item, reviewedAt, nextDueAt);
	}

	return item;
};

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
			const learning = withStreak(3);

			expect(learning.streak).toBe(3);

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
			const passed = markReviewPassed(pendingItem(), reviewedAt, nextDueAt);

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
			expect(
				Object.isFrozen(markReviewPassed(pendingItem(), reviewedAt, nextDueAt)),
			).toBe(true);
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
		test.each([
			["markReviewFailed", markReviewFailed],
			["markReviewPassed", markReviewPassed],
		] as const)("%s rejects a retired item", (_name, mark) => {
			const retired = withStreak(RETIREMENT_STREAK);

			expect(() => mark(retired, reviewedAt, nextDueAt)).toThrow(
				RetiredReviewItemError,
			);
			expect(() => mark(retired, reviewedAt, nextDueAt)).toThrow(
				"A retired review item cannot be reviewed again",
			);
		});

		test.each([
			["markReviewFailed", markReviewFailed],
			["markReviewPassed", markReviewPassed],
		] as const)("%s reports retirement before an invalid date", (_name, mark) => {
			const retired = withStreak(RETIREMENT_STREAK);

			expect(() => mark(retired, invalidDate, invalidDate)).toThrow(
				RetiredReviewItemError,
			);
		});
	});

	describe("review dates", () => {
		test.each([
			["markReviewFailed", markReviewFailed],
			["markReviewPassed", markReviewPassed],
		] as const)("%s rejects an invalid at", (_name, mark) => {
			expect(() => mark(pendingItem(), invalidDate, nextDueAt)).toThrow(
				"Invalid review item:\n- at must be a valid date",
			);
		});

		test.each([
			["markReviewFailed", markReviewFailed],
			["markReviewPassed", markReviewPassed],
		] as const)("%s rejects an invalid dueAt", (_name, mark) => {
			expect(() => mark(pendingItem(), reviewedAt, invalidDate)).toThrow(
				"Invalid review item:\n- dueAt must be a valid date",
			);
		});

		test.each([
			["markReviewFailed", markReviewFailed],
			["markReviewPassed", markReviewPassed],
		] as const)("%s reports both invalid dates at once", (_name, mark) => {
			expect(() => mark(pendingItem(), invalidDate, invalidDate)).toThrow(
				"Invalid review item:\n- at must be a valid date\n- dueAt must be a valid date",
			);
		});

		test.each([
			["markReviewFailed", markReviewFailed],
			["markReviewPassed", markReviewPassed],
		] as const)("%s rejects an at before createdAt", (_name, mark) => {
			expect(() => mark(pendingItem(), earlierAt, nextDueAt)).toThrow(
				"Invalid review item:\n- at must not precede createdAt",
			);
		});

		test.each([
			["markReviewFailed", markReviewFailed],
			["markReviewPassed", markReviewPassed],
		] as const)("%s accepts an at equal to createdAt", (_name, mark) => {
			expect(mark(pendingItem(), createdAt, nextDueAt).lastReviewedAt).toEqual(
				createdAt,
			);
		});

		test.each([
			["markReviewFailed", markReviewFailed],
			["markReviewPassed", markReviewPassed],
		] as const)("%s rejects a dueAt before at", (_name, mark) => {
			// A repetition cannot be scheduled before the review that produced it.
			expect(() => mark(pendingItem(), reviewedAt, createdAt)).toThrow(
				"Invalid review item:\n- dueAt must not precede at",
			);
		});

		test.each([
			["markReviewFailed", markReviewFailed],
			["markReviewPassed", markReviewPassed],
		] as const)("%s accepts a dueAt equal to at", (_name, mark) => {
			expect(mark(pendingItem(), reviewedAt, reviewedAt).dueAt).toEqual(
				reviewedAt,
			);
		});

		test.each([
			["markReviewFailed", markReviewFailed],
			["markReviewPassed", markReviewPassed],
		] as const)("%s reports both monotonicity issues at once", (_name, mark) => {
			expect(() => mark(pendingItem(), earlierAt, invalidDate)).toThrow(
				"Invalid review item:\n- dueAt must be a valid date",
			);
			expect(() => mark(pendingItem(), earlierAt, earlierAt)).toThrow(
				"Invalid review item:\n- at must not precede createdAt",
			);
		});
	});
});
