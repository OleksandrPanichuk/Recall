import type { Context } from "telegraf";
import type { Screen } from "./presenters/screen.types";

export const TELEGRAM_TEXT_LIMIT = 4096;
const SAFE_LIMIT = 4000;

const clamp = (text: string): string =>
	text.length <= TELEGRAM_TEXT_LIMIT
		? text
		: `${text.slice(0, SAFE_LIMIT)}\n\n…(скорочено)`;

export async function render(ctx: Context, screen: Screen): Promise<void> {
	const markup = { inline_keyboard: screen.keyboard.map((row) => [...row]) };
	const text = clamp(screen.text);

	if (ctx.callbackQuery === undefined) {
		await ctx.reply(text, { reply_markup: markup });

		return;
	}

	try {
		await ctx.editMessageText(text, { reply_markup: markup });
	} catch (error) {
		if (isUnchangedMessage(error)) {
			return;
		}

		if (!isUneditableMessage(error)) {
			throw error;
		}

		await ctx.reply(text, { reply_markup: markup });
	}
}

const messageOf = (error: unknown): string =>
	error instanceof Error ? error.message : "";

const isUnchangedMessage = (error: unknown): boolean =>
	messageOf(error).includes("message is not modified");

const isUneditableMessage = (error: unknown): boolean =>
	/message to edit not found|message can't be edited/i.test(messageOf(error));
