import { describe, expect, test } from "bun:test";
import { defaultRepetitionSettings } from "../repetition/repetition";
import {
	createQuizSettings,
	defaultQuizSettings,
	withExamMode,
	withShuffleOptions,
	withShuffleQuestions,
} from "./quiz-settings";

describe("QuizSettings", () => {
	test("keeps the exam mode off by default", () => {
		expect(defaultQuizSettings().examMode).toBe(false);
	});

	test("the exam mode turns on without touching the shuffles", () => {
		const settings = withExamMode(defaultQuizSettings(), true);

		expect(settings.examMode).toBe(true);
		expect(settings.shuffleOptions).toBe(false);
		expect(settings.shuffleQuestions).toBe(false);
	});

	test("a missing exam mode reads as off", () => {
		const settings = createQuizSettings({
			repetition: defaultRepetitionSettings(),
			shuffleOptions: false,
			shuffleQuestions: false,
			examMode: undefined as unknown as boolean,
		});

		expect(settings.examMode).toBe(false);
	});

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
			examMode: false,
		});

		expect(settings.shuffleQuestions).toBe(false);
	});
});
