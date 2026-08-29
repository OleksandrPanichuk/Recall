import type { CallbackAction, SettingsChange } from "./callback-data.constants";

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
export interface AbandonCallback {
	readonly action: typeof CallbackAction.Abandon;
}
export interface StatisticsCallback {
	readonly action: typeof CallbackAction.Statistics;
}
export interface LoginCallback {
	readonly action: typeof CallbackAction.Login;
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
		| typeof CallbackAction.StatisticsFor
		| typeof CallbackAction.SettingsFor
		| typeof CallbackAction.MistakesFor
		| typeof CallbackAction.WeakTopicsFor;
	readonly folderId?: string;
	readonly page?: number;
}
export interface StartDueCallback {
	readonly action: typeof CallbackAction.StartDue;
	readonly quizSetId: string;
}
export interface AttemptDetailCallback {
	readonly action: typeof CallbackAction.AttemptDetail;
	readonly attemptId: string;
	readonly page?: number;
}
export interface RepetitionsCallback {
	readonly action: typeof CallbackAction.Repetitions;
}
export interface RevealCallback {
	readonly action: typeof CallbackAction.Reveal;
	readonly questionId: string;
}
export interface SettingsCallback {
	readonly action: typeof CallbackAction.Settings;
}
export interface SettingsForCallback {
	readonly action: typeof CallbackAction.SettingsFor;
	readonly quizSetId?: string;
}
export interface SettingsEditCallback {
	readonly action: typeof CallbackAction.SettingsEdit;
	readonly quizSetId?: string;
	readonly change: SettingsChange;
	readonly presetKey?: string;
}

export interface MistakesCallback {
	readonly action: typeof CallbackAction.Mistakes;
}
export interface MistakesForCallback {
	readonly action: typeof CallbackAction.MistakesFor;
	readonly quizSetId: string;
}
export interface WeakTopicsCallback {
	readonly action: typeof CallbackAction.WeakTopics;
}
export interface WeakTopicsForCallback {
	readonly action: typeof CallbackAction.WeakTopicsFor;
	readonly quizSetId: string;
}

export type Callback =
	| MenuCallback
	| SetsCallback
	| ResumeCallback
	| FinishCallback
	| AbandonCallback
	| StatisticsCallback
	| StartSetCallback
	| StatisticsForCallback
	| AnswerCallback
	| ToggleCallback
	| BrowseCallback
	| StartDueCallback
	| AttemptDetailCallback
	| RepetitionsCallback
	| RevealCallback
	| SettingsCallback
	| SettingsForCallback
	| SettingsEditCallback
	| MistakesCallback
	| MistakesForCallback
	| WeakTopicsCallback
	| WeakTopicsForCallback
	| LoginCallback;
