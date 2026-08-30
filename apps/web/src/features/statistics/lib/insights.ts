import type { DailyActivity, DueForecastDay } from "@recall/contracts";

export const HEATMAP_WEEKS = 53;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface HeatmapCell {
	readonly day: string;
	readonly answered: number;
	readonly correct: number;
	readonly level: number;
}

export const isoDay = (at: Date): string => at.toISOString().slice(0, 10);

export const levelOf = (answered: number, busiest: number): number => {
	if (answered === 0) {
		return 0;
	}

	if (busiest <= 1) {
		return 3;
	}

	return Math.min(5, 1 + Math.ceil((answered / busiest) * 4));
};

export function heatmapWeeks(
	activity: readonly DailyActivity[],
	today: Date,
	weeks = HEATMAP_WEEKS,
): readonly (readonly HeatmapCell[])[] {
	const byDay = new Map(activity.map((entry) => [entry.day, entry]));
	const busiest = activity.reduce(
		(most, entry) => Math.max(most, entry.answered),
		0,
	);
	const end = new Date(`${isoDay(today)}T00:00:00.000Z`);
	const endOfWeek = new Date(
		end.getTime() + ((7 - ((end.getUTCDay() + 6) % 7) - 1) % 7) * DAY_MS,
	);
	const start = endOfWeek.getTime() - (weeks * 7 - 1) * DAY_MS;

	return Array.from({ length: weeks }, (_week, weekIndex) =>
		Array.from({ length: 7 }, (_day, dayIndex) => {
			const day = isoDay(new Date(start + (weekIndex * 7 + dayIndex) * DAY_MS));
			const entry = byDay.get(day);
			const answered = entry?.answered ?? 0;

			return {
				day,
				answered,
				correct: entry?.correct ?? 0,
				level: levelOf(answered, busiest),
			};
		}),
	);
}

export function forecastDays(
	forecast: readonly DueForecastDay[],
	today: Date,
	days: number,
): readonly DueForecastDay[] {
	const byDay = new Map(forecast.map((entry) => [entry.day, entry.due]));
	const start = new Date(`${isoDay(today)}T00:00:00.000Z`).getTime();
	const overdue = forecast
		.filter((entry) => entry.day < isoDay(today))
		.reduce((total, entry) => total + entry.due, 0);

	return Array.from({ length: days }, (_value, index) => {
		const day = isoDay(new Date(start + index * DAY_MS));

		return {
			day,
			due: (byDay.get(day) ?? 0) + (index === 0 ? overdue : 0),
		};
	});
}
