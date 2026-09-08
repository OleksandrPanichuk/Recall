import { describe, expect, test } from "bun:test";
import { streakOf } from "./get-insights";

const day = (day: string, answered: number) => ({
	day,
	attempts: 1,
	answered,
	correct: answered,
});

describe("the practice streak", () => {
	test("counts back from today while days are unbroken", () => {
		expect(
			streakOf(
				[day("2026-08-27", 3), day("2026-08-28", 1), day("2026-08-29", 2)],
				"2026-08-29",
				"2026-08-28",
			),
		).toBe(3);
	});

	test("survives a day that is still young — yesterday keeps it alive", () => {
		expect(
			streakOf(
				[day("2026-08-27", 3), day("2026-08-28", 1)],
				"2026-08-29",
				"2026-08-28",
			),
		).toBe(2);
	});

	test("is broken by a gap", () => {
		expect(
			streakOf(
				[day("2026-08-25", 3), day("2026-08-29", 2)],
				"2026-08-29",
				"2026-08-28",
			),
		).toBe(1);
	});

	test("is zero when neither today nor yesterday was practised", () => {
		expect(streakOf([day("2026-08-20", 9)], "2026-08-29", "2026-08-28")).toBe(
			0,
		);
	});

	test("ignores a day that was opened but never answered", () => {
		expect(
			streakOf(
				[day("2026-08-28", 0), day("2026-08-29", 2)],
				"2026-08-29",
				"2026-08-28",
			),
		).toBe(1);
	});
});
