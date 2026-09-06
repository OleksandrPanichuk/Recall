import type { DailyActivity } from "@recall/contracts";
import { MIN_ANSWERS_PER_WEEK, WEEKS_SHOWN } from "./AccuracyTrend.constants";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AccuracyWeek {
	readonly weekStart: string;
	readonly answered: number;
	readonly correct: number;
	readonly accuracy: number;
}

const mondayOf = (day: string): string => {
	const date = new Date(`${day}T00:00:00.000Z`);
	const weekday = (date.getUTCDay() + 6) % 7;

	return new Date(date.getTime() - weekday * DAY_MS).toISOString().slice(0, 10);
};

export function weeklyAccuracy(
	activity: readonly DailyActivity[],
	weeks = WEEKS_SHOWN,
	minimum = MIN_ANSWERS_PER_WEEK,
): readonly AccuracyWeek[] {
	const totals = new Map<string, { answered: number; correct: number }>();

	for (const day of activity) {
		if (day.answered === 0) {
			continue;
		}

		const key = mondayOf(day.day);
		const running = totals.get(key) ?? { answered: 0, correct: 0 };

		totals.set(key, {
			answered: running.answered + day.answered,
			correct: running.correct + day.correct,
		});
	}

	return [...totals.entries()]
		.filter(([, total]) => total.answered >= minimum)
		.sort(([left], [right]) => left.localeCompare(right))
		.slice(-weeks)
		.map(([weekStart, total]) => ({
			weekStart,
			answered: total.answered,
			correct: total.correct,
			accuracy: total.correct / total.answered,
		}));
}

export function trendBetween(
	weeks: readonly AccuracyWeek[],
): number | undefined {
	const first = weeks[0];
	const last = weeks.at(-1);

	return first === undefined || last === undefined || first === last
		? undefined
		: last.accuracy - first.accuracy;
}

export function pointsFor(
	weeks: readonly AccuracyWeek[],
	width: number,
	height: number,
	padding: number,
): readonly { readonly x: number; readonly y: number }[] {
	const usableWidth = width - padding * 2;
	const usableHeight = height - padding * 2;
	const step = weeks.length > 1 ? usableWidth / (weeks.length - 1) : 0;

	return weeks.map((week, index) => ({
		x: padding + (weeks.length > 1 ? index * step : usableWidth / 2),
		y: padding + (1 - week.accuracy) * usableHeight,
	}));
}
