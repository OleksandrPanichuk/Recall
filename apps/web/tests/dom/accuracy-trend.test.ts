import { describe, expect, test } from "bun:test";
import type { DailyActivity } from "@recall/contracts";
import {
	pointsFor,
	trendBetween,
	weeklyAccuracy,
} from "@/features/statistics/ui/components/AccuracyTrend/AccuracyTrend.lib";

const day = (
	date: string,
	answered: number,
	correct: number,
): DailyActivity => ({ day: date, attempts: 1, answered, correct });

describe("bucketing daily activity into weeks", () => {
	test("a week is Monday to Sunday, whatever day the answers fell on", () => {
		const weeks = weeklyAccuracy(
			[day("2026-08-05", 5, 4), day("2026-08-09", 5, 5)],
			26,
			1,
		);

		expect(weeks).toHaveLength(1);
		expect(weeks[0]?.weekStart).toBe("2026-08-03");
		expect(weeks[0]?.answered).toBe(10);
	});

	test("Monday itself starts its own week, not the previous one", () => {
		expect(weeklyAccuracy([day("2026-08-03", 5, 5)], 26, 1)[0]?.weekStart).toBe(
			"2026-08-03",
		);
	});

	test("Sunday belongs to the week that began six days earlier", () => {
		expect(weeklyAccuracy([day("2026-08-09", 5, 5)], 26, 1)[0]?.weekStart).toBe(
			"2026-08-03",
		);
	});

	test("accuracy is the week's total, not the average of its days", () => {
		const weeks = weeklyAccuracy(
			[day("2026-08-03", 1, 1), day("2026-08-04", 9, 3)],
			26,
			1,
		);

		expect(weeks[0]?.accuracy).toBeCloseTo(0.4, 5);
	});
});

describe("which weeks are worth plotting", () => {
	test("a day with no answers is not a week with zero accuracy", () => {
		expect(weeklyAccuracy([day("2026-08-03", 0, 0)], 26, 1)).toEqual([]);
	});

	test("a week too thin to mean anything is left out", () => {
		expect(weeklyAccuracy([day("2026-08-03", 3, 3)], 26, 5)).toEqual([]);
		expect(weeklyAccuracy([day("2026-08-03", 5, 5)], 26, 5)).toHaveLength(1);
	});

	test("only the most recent weeks are kept, and in order", () => {
		const weeks = weeklyAccuracy(
			[
				day("2026-06-01", 5, 5),
				day("2026-06-08", 5, 4),
				day("2026-06-15", 5, 3),
			],
			2,
			1,
		);

		expect(weeks.map((week) => week.weekStart)).toEqual([
			"2026-06-08",
			"2026-06-15",
		]);
	});
});

describe("the change the caption reports", () => {
	test("is last minus first, so a fall is negative", () => {
		const weeks = weeklyAccuracy(
			[day("2026-06-01", 10, 9), day("2026-06-08", 10, 5)],
			26,
			1,
		);

		expect(trendBetween(weeks)).toBeCloseTo(-0.4, 5);
	});

	test("is undefined with a single week, because there is no change yet", () => {
		expect(
			trendBetween(weeklyAccuracy([day("2026-06-01", 10, 9)], 26, 1)),
		).toBe(undefined);
	});
});

describe("placing the points", () => {
	const weeks = weeklyAccuracy(
		[day("2026-06-01", 10, 10), day("2026-06-08", 10, 5)],
		26,
		1,
	);

	test("100% sits at the top edge and 50% halfway down", () => {
		const [top, middle] = pointsFor(weeks, 100, 100, 10);

		expect(top?.y).toBe(10);
		expect(middle?.y).toBe(50);
	});

	test("the first and last points touch the padded edges", () => {
		const points = pointsFor(weeks, 100, 100, 10);

		expect(points[0]?.x).toBe(10);
		expect(points.at(-1)?.x).toBe(90);
	});

	test("a lone point is centred rather than pinned to the left", () => {
		const single = weeklyAccuracy([day("2026-06-01", 10, 10)], 26, 1);

		expect(pointsFor(single, 100, 100, 10)[0]?.x).toBe(50);
	});
});
