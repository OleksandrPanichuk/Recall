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
	Browse: "b",
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
export interface BrowseCallback {
	readonly action: typeof CallbackAction.Browse;
	readonly leaf:
		| typeof CallbackAction.StartSet
		| typeof CallbackAction.StatisticsFor;
	readonly folderId?: string;
	readonly page?: number;
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
			return callback.action;
		case CallbackAction.StartSet:
		case CallbackAction.StatisticsFor:
			return [callback.action, callback.quizSetId].join(SEPARATOR);
		case CallbackAction.Unavailable:
			return [callback.action, callback.feature].join(SEPARATOR);
		case CallbackAction.Browse:
			return [
				callback.action,
				callback.leaf,
				callback.folderId ?? "",
				String(callback.page ?? 0),
			].join(SEPARATOR);
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

export function decodeCallback(data: string): Callback | undefined {
	const [action, first, second, third] = data.split(SEPARATOR);

	switch (action) {
		case CallbackAction.Menu:
		case CallbackAction.Sets:
		case CallbackAction.Resume:
		case CallbackAction.Finish:
		case CallbackAction.Statistics:
			return { action };
		case CallbackAction.StartSet:
		case CallbackAction.StatisticsFor:
			return first === undefined || first.length === 0
				? undefined
				: { action, quizSetId: first };
		case CallbackAction.Unavailable:
			return first === undefined || first.length === 0
				? undefined
				: { action, feature: first };
		case CallbackAction.Browse: {
			if (
				first !== CallbackAction.StartSet &&
				first !== CallbackAction.StatisticsFor
			) {
				return undefined;
			}

			const page = Number(third ?? "0");

			if (!Number.isSafeInteger(page) || page < 0) {
				return undefined;
			}

			return {
				action,
				leaf: first,
				folderId:
					second === undefined || second.length === 0 ? undefined : second,
				page,
			};
		}
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
