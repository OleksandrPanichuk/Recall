import { describe, expect, test } from "bun:test";
import { ReviewItemValidationError } from "./review.errors";
import {
	isReviewRating,
	nextReviewDueAt,
	REVIEW_INTERVALS_DAYS,
	ReviewRating,
	startOfDayInTimezone,
} from "./review-schedule";

const KYIV = "Europe/Kyiv";

const due = (
	at: string,
	streak: number,
	rating: ReviewRating,
	timezone = KYIV,
): string =>
	nextReviewDueAt({ streak, rating, at: new Date(at), timezone }).toISOString();

describe("isReviewRating", () => {
	test.each(Object.values(ReviewRating))("accepts %p", (value) => {
		expect(isReviewRating(value)).toBe(true);
	});

	test.each([
		"again",
		"",
		"Good",
		undefined,
		null,
		0,
	])("rejects %p", (value) => {
		expect(isReviewRating(value)).toBe(false);
	});
});

describe("startOfDayInTimezone", () => {
	test("rewinds to local midnight, not UTC midnight", () => {
		// 00:30 Kyiv on 2 August is still 21:30 UTC on 1 August.
		expect(
			startOfDayInTimezone(
				new Date("2026-08-01T21:30:00.000Z"),
				KYIV,
			).toISOString(),
		).toBe("2026-08-01T21:00:00.000Z");
	});

	test("is idempotent", () => {
		const first = startOfDayInTimezone(
			new Date("2026-08-01T21:30:00.000Z"),
			KYIV,
		);

		expect(startOfDayInTimezone(first, KYIV).toISOString()).toBe(
			first.toISOString(),
		);
	});

	test("honours a different zone", () => {
		expect(
			startOfDayInTimezone(
				new Date("2026-08-01T12:00:00.000Z"),
				"UTC",
			).toISOString(),
		).toBe("2026-08-01T00:00:00.000Z");
	});
});

describe("nextReviewDueAt", () => {
	test("a hard rating always returns to the shortest interval", () => {
		expect(due("2026-08-01T10:00:00.000Z", 3, ReviewRating.Hard)).toBe(
			"2026-08-01T21:00:00.000Z",
		);
	});

	test.each([
		[1, "2026-08-01T21:00:00.000Z"],
		[2, "2026-08-03T21:00:00.000Z"],
		[3, "2026-08-07T21:00:00.000Z"],
		[4, "2026-08-21T21:00:00.000Z"],
	])("a good rating at streak %p walks the ladder", (streak, expected) => {
		expect(due("2026-08-01T10:00:00.000Z", streak, ReviewRating.Good)).toBe(
			expected,
		);
	});

	test("an easy rating skips one rung", () => {
		expect(due("2026-08-01T10:00:00.000Z", 1, ReviewRating.Good)).toBe(
			"2026-08-01T21:00:00.000Z",
		);
		expect(due("2026-08-01T10:00:00.000Z", 1, ReviewRating.Easy)).toBe(
			"2026-08-03T21:00:00.000Z",
		);
	});

	test("the ladder stops at the longest interval", () => {
		expect(due("2026-08-01T10:00:00.000Z", 99, ReviewRating.Easy)).toBe(
			due("2026-08-01T10:00:00.000Z", 4, ReviewRating.Good),
		);
	});

	test("the due time is always local midnight", () => {
		for (const at of [
			"2026-08-01T00:30:00.000Z",
			"2026-08-01T12:00:00.000Z",
			"2026-08-01T23:59:59.000Z",
		]) {
			expect(due(at, 1, ReviewRating.Good)).toMatch(/T2[12]:00:00\.000Z$/);
		}
	});

	// A review just before local midnight must fall due the next local day, not
	// the same one — this is the boundary the plan calls out.
	test("a review just before local midnight lands on the next local day", () => {
		// 23:30 Kyiv on 1 August is 20:30 UTC.
		expect(due("2026-08-01T20:30:00.000Z", 1, ReviewRating.Good)).toBe(
			"2026-08-01T21:00:00.000Z",
		);
		// 00:30 Kyiv on 2 August is 21:30 UTC on 1 August — one day later again.
		expect(due("2026-08-01T21:30:00.000Z", 1, ReviewRating.Good)).toBe(
			"2026-08-02T21:00:00.000Z",
		);
	});

	// Kyiv leaves DST on 25 October 2026: UTC+3 becomes UTC+2, so local midnight
	// shifts from 21:00Z to 22:00Z. A naive "+24 hours" lands an hour off.
	test("survives a daylight-saving transition", () => {
		expect(due("2026-10-24T10:00:00.000Z", 1, ReviewRating.Good)).toBe(
			"2026-10-24T21:00:00.000Z",
		);
		expect(due("2026-10-25T10:00:00.000Z", 1, ReviewRating.Good)).toBe(
			"2026-10-25T22:00:00.000Z",
		);
	});

	test("crosses a month boundary", () => {
		expect(due("2026-08-31T10:00:00.000Z", 4, ReviewRating.Good)).toBe(
			"2026-09-20T21:00:00.000Z",
		);
	});

	test("is deterministic", () => {
		const first = due("2026-08-01T10:00:00.000Z", 2, ReviewRating.Good);

		expect(due("2026-08-01T10:00:00.000Z", 2, ReviewRating.Good)).toBe(first);
	});

	test("never schedules into the past", () => {
		const at = new Date("2026-08-01T10:00:00.000Z");

		for (const rating of Object.values(ReviewRating)) {
			for (
				let streak = 0;
				streak <= REVIEW_INTERVALS_DAYS.length;
				streak += 1
			) {
				expect(
					nextReviewDueAt({ streak, rating, at, timezone: KYIV }).getTime(),
				).toBeGreaterThan(at.getTime());
			}
		}
	});

	test("rejects an invalid date", () => {
		expect(() =>
			nextReviewDueAt({
				streak: 1,
				rating: ReviewRating.Good,
				at: new Date("nope"),
				timezone: KYIV,
			}),
		).toThrow(ReviewItemValidationError);
	});

	test("rejects a negative streak", () => {
		expect(() =>
			nextReviewDueAt({
				streak: -1,
				rating: ReviewRating.Good,
				at: new Date("2026-08-01T10:00:00.000Z"),
				timezone: KYIV,
			}),
		).toThrow(ReviewItemValidationError);
	});
});

describe("rating ordering", () => {
	test("easy always falls no sooner than good, and good no sooner than hard", () => {
		for (let streak = 0; streak <= 5; streak += 1) {
			const hard = due("2026-08-01T10:00:00.000Z", streak, ReviewRating.Hard);
			const good = due("2026-08-01T10:00:00.000Z", streak, ReviewRating.Good);
			const easy = due("2026-08-01T10:00:00.000Z", streak, ReviewRating.Easy);

			expect(hard <= good).toBe(true);
			expect(good <= easy).toBe(true);
		}
	});

	test("easy outranks hard even on a question just missed", () => {
		expect(
			due("2026-08-01T10:00:00.000Z", 0, ReviewRating.Easy) >
				due("2026-08-01T10:00:00.000Z", 0, ReviewRating.Hard),
		).toBe(true);
	});
});
