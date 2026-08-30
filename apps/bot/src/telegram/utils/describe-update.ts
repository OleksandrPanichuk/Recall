import type { LogFields } from "@recall/kit";
import type { Context } from "telegraf";
import { decodeCallback } from "../callbacks/callback-data";
import { CallbackAction } from "../callbacks/callback-data.constants";
import type { Callback } from "../callbacks/callback-data.types";

const CALLBACK_ACTION_NAMES: Readonly<Record<CallbackAction, string>> = {
	[CallbackAction.Login]: "login",
	[CallbackAction.Menu]: "menu",
	[CallbackAction.Sets]: "sets",
	[CallbackAction.StartSet]: "start-set",
	[CallbackAction.Resume]: "resume",
	[CallbackAction.Answer]: "answer",
	[CallbackAction.Toggle]: "toggle",
	[CallbackAction.Finish]: "finish",
	[CallbackAction.Abandon]: "abandon",
	[CallbackAction.Statistics]: "statistics",
	[CallbackAction.StatisticsFor]: "statistics-for",
	[CallbackAction.Browse]: "browse",
	[CallbackAction.Reveal]: "reveal",
	[CallbackAction.Repetitions]: "repetitions",
	[CallbackAction.AttemptDetail]: "attempt-detail",
	[CallbackAction.StartDue]: "start-due",
	[CallbackAction.Settings]: "settings",
	[CallbackAction.SettingsFor]: "settings-for",
	[CallbackAction.SettingsEdit]: "settings-edit",
	[CallbackAction.Mistakes]: "mistakes",
	[CallbackAction.MistakesFor]: "mistakes-for",
	[CallbackAction.WeakTopics]: "weak-topics",
	[CallbackAction.WeakTopicsFor]: "weak-topics-for",
};

function describeCallback(callback: Callback): LogFields {
	switch (callback.action) {
		case CallbackAction.StartSet:
		case CallbackAction.StatisticsFor:
		case CallbackAction.SettingsFor:
		case CallbackAction.MistakesFor:
		case CallbackAction.WeakTopicsFor:
			return { quizSetId: callback.quizSetId };
		case CallbackAction.SettingsEdit:
			return { quizSetId: callback.quizSetId, change: callback.change };
		case CallbackAction.Answer:
		case CallbackAction.Toggle:
			return {
				questionId: callback.questionId,
				optionCount: callback.optionPositions.length,
			};
		case CallbackAction.Browse:
			return { folderId: callback.folderId, page: callback.page };
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
