import {
	createRepetitionSettings,
	defaultRepetitionSettings,
	type RepetitionSettings,
} from "../repetition/repetition";

export interface QuizSettings {
	readonly repetition: RepetitionSettings;
	readonly shuffleOptions: boolean;
}

export const defaultQuizSettings = (): QuizSettings =>
	Object.freeze({
		repetition: defaultRepetitionSettings(),
		shuffleOptions: false,
	});

export function createQuizSettings(draft: QuizSettings): QuizSettings {
	return Object.freeze({
		repetition: createRepetitionSettings(draft.repetition),
		shuffleOptions: draft.shuffleOptions === true,
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
