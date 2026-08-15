import type { CallbackAction } from "./callback-data.constants";

export interface MenuCallback {
	readonly action: typeof CallbackAction.Menu;
}
export interface SetsCallback {
	readonly action: typeof CallbackAction.Sets;
}
export interface ResumeCallback {
	readonly action: typeof CallbackAction.Resume;
}
export interface FinishCallback {
	readonly action: typeof CallbackAction.Finish;
}
export interface StatisticsCallback {
	readonly action: typeof CallbackAction.Statistics;
}
export interface StartSetCallback {
	readonly action: typeof CallbackAction.StartSet;
	readonly quizSetId: string;
}
export interface StatisticsForCallback {
	readonly action: typeof CallbackAction.StatisticsFor;
	readonly quizSetId: string;
}
export interface AnswerCallback {
	readonly action: typeof CallbackAction.Answer;
	readonly questionId: string;
	readonly optionPositions: readonly number[];
}
export interface ToggleCallback {
	readonly action: typeof CallbackAction.Toggle;
	readonly questionId: string;
	readonly optionPositions: readonly number[];
}
export interface BrowseCallback {
	readonly action: typeof CallbackAction.Browse;
	readonly leaf:
		| typeof CallbackAction.StartSet
		| typeof CallbackAction.StatisticsFor;
	readonly folderId?: string;
	readonly page?: number;
}
export interface RepetitionsCallback {
	readonly action: typeof CallbackAction.Repetitions;
}
export interface RevealCallback {
	readonly action: typeof CallbackAction.Reveal;
	readonly questionId: string;
}
export interface UnavailableCallback {
	readonly action: typeof CallbackAction.Unavailable;
	readonly feature: string;
}

export type Callback =
	| MenuCallback
	| SetsCallback
	| ResumeCallback
	| FinishCallback
	| StatisticsCallback
	| StartSetCallback
	| StatisticsForCallback
	| AnswerCallback
	| ToggleCallback
	| BrowseCallback
	| RepetitionsCallback
	| RevealCallback
	| UnavailableCallback;
