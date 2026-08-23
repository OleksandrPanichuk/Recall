import { describe, expect, test } from "bun:test";
import {
	CEILING_STEPS,
	INTERVAL_PRESETS,
	REPETITION_STEPS,
	steppedDown,
	steppedUp,
} from "./quiz-settings.constants";

describe("stepping through a ladder", () => {
	test("moves to the next rung", () => {
		expect(steppedUp(CEILING_STEPS, 30)).toBe(60);
		expect(steppedDown(CEILING_STEPS, 30)).toBe(14);
	});

	test("stops at the ends instead of falling off", () => {
		expect(steppedUp(CEILING_STEPS, 365)).toBe(365);
		expect(steppedDown(CEILING_STEPS, 1)).toBe(1);
	});

	test("climbs out of a value that is not on the ladder", () => {
		expect(steppedUp(CEILING_STEPS, 45)).toBe(60);
		expect(steppedDown(CEILING_STEPS, 45)).toBe(30);
	});

	test("every rung is reachable from either end", () => {
		for (const steps of [CEILING_STEPS, REPETITION_STEPS]) {
			const climbed: number[] = [steps[0] as number];

			while (steppedUp(steps, climbed.at(-1) as number) !== climbed.at(-1)) {
				climbed.push(steppedUp(steps, climbed.at(-1) as number));
			}

			expect(climbed).toEqual([...steps]);
		}
	});
});

describe("interval presets", () => {
	test("every preset rises and stays whole", () => {
		for (const preset of INTERVAL_PRESETS) {
			expect(preset.intervalsDays.length).toBeGreaterThan(0);
			expect(
				preset.intervalsDays.every(
					(days, index) =>
						Number.isSafeInteger(days) &&
						days > 0 &&
						(index === 0 || days > (preset.intervalsDays[index - 1] as number)),
				),
			).toBe(true);
		}
	});

	test("presets are distinguishable by key and by ladder", () => {
		expect(new Set(INTERVAL_PRESETS.map((preset) => preset.key)).size).toBe(
			INTERVAL_PRESETS.length,
		);
		expect(
			new Set(INTERVAL_PRESETS.map((preset) => preset.intervalsDays.join(",")))
				.size,
		).toBe(INTERVAL_PRESETS.length);
	});
});
