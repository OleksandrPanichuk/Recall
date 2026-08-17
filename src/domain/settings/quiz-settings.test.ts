import { describe, expect, test } from "bun:test";
import { defaultRepetitionSettings } from "../repetition/repetition";
import {
	createQuizSettings,
	defaultQuizSettings,
	withShuffleOptions,
	withShuffleQuestions,
} from "./quiz-settings";

describe("QuizSettings", () => {
	test("shuffles nothing by default", () => {
		const settings = defaultQuizSettings();

		expect(settings.shuffleOptions).toBe(false);
		expect(settings.shuffleQuestions).toBe(false);
	});

	test("question shuffling turns on without touching the option order", () => {
		const settings = withShuffleQuestions(defaultQuizSettings(), true);

		expect(settings.shuffleQuestions).toBe(true);
		expect(settings.shuffleOptions).toBe(false);
	});

	test("option shuffling turns on without touching the question order", () => {
		const settings = withShuffleOptions(defaultQuizSettings(), true);

		expect(settings.shuffleOptions).toBe(true);
		expect(settings.shuffleQuestions).toBe(false);
	});

	test("a missing question shuffle reads as off", () => {
		const settings = createQuizSettings({
			repetition: defaultRepetitionSettings(),
			shuffleOptions: false,
			shuffleQuestions: undefined as unknown as boolean,
		});

		expect(settings.shuffleQuestions).toBe(false);
	});
});
