import type { Context } from "telegraf";
import type { InlineButton, Screen } from "./presenters/screen.types";
import { clamped } from "./presenters/utils/text-limit";

export interface Message {
	readonly text: string;
	readonly extra: {
		readonly reply_markup: { inline_keyboard: InlineButton[][] };
		readonly link_preview_options?: { is_disabled: boolean };
	};
}

export function messageFor(screen: Screen): Message {
	return {
		text: clamped(screen.text),
		extra: {
			reply_markup: {
				inline_keyboard: screen.keyboard.map((row) => [...row]),
			},
			...(screen.linkPreview === false
				? { link_preview_options: { is_disabled: true } }
				: {}),
		},
	};
}

export async function render(ctx: Context, screen: Screen): Promise<void> {
	const { text, extra } = messageFor(screen);

	if (ctx.callbackQuery === undefined) {
		await ctx.reply(text, extra);

		return;
	}

	try {
		await ctx.editMessageText(text, extra);
	} catch (error) {
		if (isUnchangedMessage(error)) {
			return;
		}

		if (!isUneditableMessage(error)) {
			throw error;
		}

		await ctx.reply(text, extra);
	}
}

const messageOf = (error: unknown): string =>
	error instanceof Error ? error.message : "";

const isUnchangedMessage = (error: unknown): boolean =>
	messageOf(error).includes("message is not modified");

const isUneditableMessage = (error: unknown): boolean =>
	/message to edit not found|message can't be edited/i.test(messageOf(error));
