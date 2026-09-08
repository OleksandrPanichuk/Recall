import { describe, expect, test } from "bun:test";
import { ScheduleEntity } from "@/modules/scheduling";
import { StudySettingsEntity } from "./study-settings.entity";

describe("QuizSettings", () => {
	test("keeps the exam mode off by default", () => {
		expect(StudySettingsEntity.defaults().examMode).toBe(false);
	});

	test("the exam mode turns on without touching the shuffles", () => {
		const settings = StudySettingsEntity.withExamMode(
			StudySettingsEntity.defaults(),
			true,
		);

		expect(settings.examMode).toBe(true);
		expect(settings.shuffleOptions).toBe(false);
		expect(settings.shuffleQuestions).toBe(false);
	});

	test("a missing exam mode reads as off", () => {
		const settings = StudySettingsEntity.create({
			repetition: ScheduleEntity.defaultSettings(),
			shuffleOptions: false,
			shuffleQuestions: false,
			examMode: undefined as unknown as boolean,
		});

		expect(settings.examMode).toBe(false);
	});

	test("shuffles nothing by default", () => {
		const settings = StudySettingsEntity.defaults();

		expect(settings.shuffleOptions).toBe(false);
		expect(settings.shuffleQuestions).toBe(false);
	});

	test("question shuffling turns on without touching the option order", () => {
		const settings = StudySettingsEntity.withShuffleQuestions(
			StudySettingsEntity.defaults(),
			true,
		);

		expect(settings.shuffleQuestions).toBe(true);
		expect(settings.shuffleOptions).toBe(false);
	});

	test("option shuffling turns on without touching the question order", () => {
		const settings = StudySettingsEntity.withShuffleOptions(
			StudySettingsEntity.defaults(),
			true,
		);

		expect(settings.shuffleOptions).toBe(true);
		expect(settings.shuffleQuestions).toBe(false);
	});

	test("a missing question shuffle reads as off", () => {
		const settings = StudySettingsEntity.create({
			repetition: ScheduleEntity.defaultSettings(),
			shuffleOptions: false,
			shuffleQuestions: undefined as unknown as boolean,
			examMode: false,
		});

		expect(settings.shuffleQuestions).toBe(false);
	});
});
