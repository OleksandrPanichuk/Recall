import type { Context } from "telegraf";
import type { LogFields } from "@/infrastructure/logging/logger.types";
import {
	type Callback,
	CallbackAction,
	decodeCallback,
} from "../callbacks/callback-data";

const CALLBACK_ACTION_NAMES: Readonly<Record<CallbackAction, string>> = {
	[CallbackAction.Menu]: "menu",
	[CallbackAction.Sets]: "sets",
	[CallbackAction.StartSet]: "start-set",
	[CallbackAction.Resume]: "resume",
	[CallbackAction.Answer]: "answer",
	[CallbackAction.Toggle]: "toggle",
	[CallbackAction.Finish]: "finish",
	[CallbackAction.Statistics]: "statistics",
	[CallbackAction.StatisticsFor]: "statistics-for",
	[CallbackAction.Browse]: "browse",
	[CallbackAction.Unavailable]: "unavailable",
};

// Ids and positions identify what the user pressed; the prompt, option text and
// message body behind them stay out of the log.
function describeCallback(callback: Callback): LogFields {
	switch (callback.action) {
		case CallbackAction.StartSet:
		case CallbackAction.StatisticsFor:
			return { quizSetId: callback.quizSetId };
		case CallbackAction.Answer:
		case CallbackAction.Toggle:
			return {
				questionId: callback.questionId,
				optionCount: callback.optionPositions.length,
			};
		case CallbackAction.Browse:
			return { folderId: callback.folderId, page: callback.page };
		case CallbackAction.Unavailable:
			return { feature: callback.feature };
		default:
			return {};
	}
}

export function describeUpdate(ctx: Context): LogFields {
	const identity = { telegramUserId: ctx.from?.id };
	const query = ctx.callbackQuery;

	if (query !== undefined) {
		const data = "data" in query ? query.data : undefined;
		const callback = data === undefined ? undefined : decodeCallback(data);

		return {
			...identity,
			update: "callback_query",
			action:
				callback === undefined
					? "undecodable"
					: CALLBACK_ACTION_NAMES[callback.action],
			...(callback === undefined ? {} : describeCallback(callback)),
		};
	}

	const message = ctx.message;

	if (message !== undefined && "text" in message) {
		const text = message.text;

		return {
			...identity,
			update: "message",
			command: text.startsWith("/") ? text.split(" ")[0] : undefined,
			textLength: text.length,
		};
	}

	return { ...identity, update: ctx.updateType };
}
