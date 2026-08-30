import {
	createRepetitionSettings,
	defaultRepetitionSettings,
	type RepetitionSettings,
} from "../repetition/repetition";

export interface QuizSettings {
	readonly repetition: RepetitionSettings;
	readonly shuffleOptions: boolean;
	readonly shuffleQuestions: boolean;
	readonly examMode: boolean;
}

export const defaultQuizSettings = (): QuizSettings =>
	Object.freeze({
		repetition: defaultRepetitionSettings(),
		shuffleOptions: false,
		shuffleQuestions: false,
		examMode: false,
	});

export function createQuizSettings(draft: QuizSettings): QuizSettings {
	return Object.freeze({
		repetition: createRepetitionSettings(draft.repetition),
		shuffleOptions: draft.shuffleOptions === true,
		shuffleQuestions: draft.shuffleQuestions === true,
		examMode: draft.examMode === true,
	});
}

export const withRepetition = (
	settings: QuizSettings,
	repetition: RepetitionSettings,
): QuizSettings => createQuizSettings({ ...settings, repetition });

export const withShuffleOptions = (
	settings: QuizSettings,
	shuffleOptions: boolean,
): QuizSettings => createQuizSettings({ ...settings, shuffleOptions });

export const withShuffleQuestions = (
	settings: QuizSettings,
	shuffleQuestions: boolean,
): QuizSettings => createQuizSettings({ ...settings, shuffleQuestions });

export const withExamMode = (
	settings: QuizSettings,
	examMode: boolean,
): QuizSettings => createQuizSettings({ ...settings, examMode });
