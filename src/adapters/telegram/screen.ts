import type { Context } from "telegraf";
import type { Screen } from "./presenters/menu.presenter";

/** Telegram rejects a message body over 4096 characters outright. */
export const TELEGRAM_TEXT_LIMIT = 4096;
const SAFE_LIMIT = 4000;

const clamp = (text: string): string =>
	text.length <= TELEGRAM_TEXT_LIMIT
		? text
		: `${text.slice(0, SAFE_LIMIT)}\n\n…(скорочено)`;

/**
 * Sends a screen. A callback edits the message in place so the chat does not
 * grow a new card per tap.
 *
 * Every branch below is a real Telegram response, and none of them means the
 * session should end:
 *
 * - "message is not modified" is exactly what a duplicate tap produces;
 * - "message to edit not found" / "can't be edited" means the message is gone or
 *   frozen — the user deleted it, cleared the chat, or an update was replayed
 *   after downtime — so send a fresh one rather than failing.
 */
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
