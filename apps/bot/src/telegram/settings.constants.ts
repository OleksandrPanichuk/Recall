export interface IntervalPreset {
	readonly key: string;
	readonly label: string;
	readonly intervalsDays: readonly number[];
}

export const INTERVAL_PRESETS: readonly IntervalPreset[] = Object.freeze([
	Object.freeze({
		key: "fast",
		label: "Швидко",
		intervalsDays: Object.freeze([1, 2, 4, 7, 14]),
	}),
	Object.freeze({
		key: "steady",
		label: "Стандарт",
		intervalsDays: Object.freeze([1, 3, 7, 14, 30]),
	}),
	Object.freeze({
		key: "slow",
		label: "Повільно",
		intervalsDays: Object.freeze([1, 3, 7, 21, 60]),
	}),
]);

export const CEILING_STEPS: readonly number[] = Object.freeze([
	1, 3, 7, 14, 30, 60, 90, 180, 365,
]);

export const REPETITION_STEPS: readonly number[] = Object.freeze([
	1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 100,
]);

export function steppedUp(steps: readonly number[], value: number): number {
	return steps.find((step) => step > value) ?? value;
}

export function steppedDown(steps: readonly number[], value: number): number {
	return steps.findLast((step) => step < value) ?? value;
}
