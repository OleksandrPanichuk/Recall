import { CallbackAction } from "./callback-data.constants";
import type { Callback } from "./callback-data.types";

export const CALLBACK_DATA_LIMIT = 64;

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
		case CallbackAction.Repetitions:
			return callback.action;
		case CallbackAction.StartSet:
		case CallbackAction.StatisticsFor:
			return [callback.action, callback.quizSetId].join(SEPARATOR);
		case CallbackAction.Reveal:
			return [callback.action, callback.questionId].join(SEPARATOR);
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
		case CallbackAction.Repetitions:
			return { action };
		case CallbackAction.StartSet:
		case CallbackAction.StatisticsFor:
			return first === undefined || first.length === 0
				? undefined
				: { action, quizSetId: first };
		case CallbackAction.Reveal:
			return first === undefined || first.length === 0
				? undefined
				: { action, questionId: first };
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
