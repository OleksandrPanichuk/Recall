import { describe, expect, test } from "bun:test";
import type { ResolvedQuizSettings } from "@recall/contracts";
import { settingsScreen } from "./settings.presenter";

const resolved = (
	repetition: Partial<ResolvedQuizSettings["settings"]["repetition"]> = {},
): ResolvedQuizSettings => ({
	source: "global",
	settings: {
		repetition: {
			scheduler: "ladder",
			intervalsDays: [1, 3, 7],
			maxIntervalDays: 30,
			maxRepetitions: 5,
			desiredRetention: 0.9,
			...repetition,
		},
		shuffleOptions: false,
		shuffleQuestions: false,
		examMode: false,
	},
});

describe("the settings screen under each scheduler", () => {
	test("the ladder is spelled out", () => {
		expect(settingsScreen(resolved()).text).toContain("Драбина: 1 → 3 → 7 дн.");
	});

	test("fsrs names itself and its target instead of a ladder it ignores", () => {
		const text = settingsScreen(
			resolved({ scheduler: "fsrs", desiredRetention: 0.95 }),
		).text;

		expect(text).toContain("FSRS");
		expect(text).toContain("95%");
		expect(text).not.toContain("Драбина");
	});

	test("fsrs drops the repetition cap, which only the ladder retires on", () => {
		expect(settingsScreen(resolved({ scheduler: "fsrs" })).text).not.toContain(
			"Максимум повторень",
		);
		expect(settingsScreen(resolved()).text).toContain("Максимум повторень");
	});
});
