/**
 * Callback payloads carry only stable identifiers and the user's own selection —
 * never which option is correct. Telegram caps `callback_data` at 64 bytes, so
 * options travel as their positions within the question rather than as ids.
 *
 * Selections are encoded into the buttons themselves rather than held in memory,
 * so a multiple-choice question keeps its half-made selection across a restart
 * and cannot be corrupted by a stale message from an earlier screen.
 */
export const CALLBACK_DATA_LIMIT = 64;

export const CallbackAction = {
	Menu: "m",
	Sets: "l",
	StartSet: "s",
	Resume: "r",
	Answer: "a",
	Toggle: "t",
	Finish: "f",
	Statistics: "x",
	StatisticsFor: "y",
	Mistakes: "k",
	WeakTopics: "w",
	Rate: "v",
	Unavailable: "u",
} as const;
export type CallbackAction =
	(typeof CallbackAction)[keyof typeof CallbackAction];

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
export interface MistakesCallback {
	readonly action: typeof CallbackAction.Mistakes;
}
export interface WeakTopicsCallback {
	readonly action: typeof CallbackAction.WeakTopics;
}
export interface RateCallback {
	readonly action: typeof CallbackAction.Rate;
	readonly questionId: string;
	readonly rating: string;
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
	| MistakesCallback
	| WeakTopicsCallback
	| RateCallback
	| UnavailableCallback;

export class CallbackTooLongError extends Error {
	constructor(data: string) {
		super(
			`Callback data is ${data.length} bytes, over the ${CALLBACK_DATA_LIMIT}-byte Telegram limit: ${data}`,
		);
		this.name = "CallbackTooLongError";
	}
}

const SEPARATOR = ":";

export function encodeCallback(callback: Callback): string {
	const data = serialise(callback);

	// Telegram rejects an over-long payload at send time with an opaque API error.
	// Failing here instead points at the identifier that outgrew the limit.
	if (data.length > CALLBACK_DATA_LIMIT) {
		throw new CallbackTooLongError(data);
	}

	return data;
}

function serialise(callback: Callback): string {
	switch (callback.action) {
		case CallbackAction.Menu:
		case CallbackAction.Sets:
		case CallbackAction.Resume:
		case CallbackAction.Finish:
		case CallbackAction.Statistics:
		case CallbackAction.Mistakes:
		case CallbackAction.WeakTopics:
			return callback.action;
		case CallbackAction.Rate:
			return [callback.action, callback.questionId, callback.rating].join(
				SEPARATOR,
			);
		case CallbackAction.StartSet:
		case CallbackAction.StatisticsFor:
			return [callback.action, callback.quizSetId].join(SEPARATOR);
		case CallbackAction.Unavailable:
			return [callback.action, callback.feature].join(SEPARATOR);
		case CallbackAction.Answer:
		case CallbackAction.Toggle:
			return [
				callback.action,
				callback.questionId,
				callback.optionPositions.join(","),
			].join(SEPARATOR);
	}
}

const parsePositions = (raw: string | undefined): readonly number[] | null => {
	if (raw === undefined || raw.length === 0) {
		return [];
	}

	const positions = raw.split(",").map(Number);

	if (
		positions.some(
			(position) => !Number.isSafeInteger(position) || position < 0,
		)
	) {
		return null;
	}

	return positions;
};

/** Returns undefined for anything malformed; callers must not trust the wire. */
export function decodeCallback(data: string): Callback | undefined {
	const [action, first, second] = data.split(SEPARATOR);

	switch (action) {
		case CallbackAction.Menu:
		case CallbackAction.Sets:
		case CallbackAction.Resume:
		case CallbackAction.Finish:
		case CallbackAction.Statistics:
		case CallbackAction.Mistakes:
		case CallbackAction.WeakTopics:
			return { action };
		case CallbackAction.Rate:
			return first === undefined ||
				first.length === 0 ||
				second === undefined ||
				second.length === 0
				? undefined
				: { action, questionId: first, rating: second };
		case CallbackAction.StartSet:
		case CallbackAction.StatisticsFor:
			return first === undefined || first.length === 0
				? undefined
				: { action, quizSetId: first };
		case CallbackAction.Unavailable:
			return first === undefined || first.length === 0
				? undefined
				: { action, feature: first };
		case CallbackAction.Answer:
		case CallbackAction.Toggle: {
			const optionPositions = parsePositions(second);

			if (
				first === undefined ||
				first.length === 0 ||
				optionPositions === null
			) {
				return undefined;
			}

			return { action, questionId: first, optionPositions };
		}
		default:
			return undefined;
	}
}
