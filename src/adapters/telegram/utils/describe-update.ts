import type { Context } from "telegraf";
import type { LogFields } from "@/infrastructure/logging/logger.types";
import { decodeCallback } from "../callbacks/callback-data";
import { CallbackAction } from "../callbacks/callback-data.constants";
import type { Callback } from "../callbacks/callback-data.types";

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
	[CallbackAction.Reveal]: "reveal",
	[CallbackAction.Repetitions]: "repetitions",
	[CallbackAction.Unavailable]: "unavailable",
};

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

const COMMAND = /^\/[A-Za-z0-9_]{1,32}(@[A-Za-z0-9_]{1,32})?(?=\s|$)/;

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
			command: COMMAND.exec(text)?.[0],
			textLength: text.length,
		};
	}

	return { ...identity, update: updateTypeOf(ctx) };
}

export function updateTypeOf(ctx: Context): string {
	try {
		return ctx.updateType;
	} catch {
		return "unknown";
	}
}
