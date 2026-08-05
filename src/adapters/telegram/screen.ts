import type { Context } from "telegraf";
import type { Screen } from "./presenters/menu.presenter";

/**
 * Sends a screen. A callback edits the message in place so the chat does not
 * grow a new card per tap; Telegram rejects an edit whose content is identical,
 * which is exactly what a duplicate tap produces, so that error is swallowed.
 */
export async function render(ctx: Context, screen: Screen): Promise<void> {
	const markup = { inline_keyboard: screen.keyboard.map((row) => [...row]) };

	if (ctx.callbackQuery === undefined) {
		await ctx.reply(screen.text, { reply_markup: markup });

		return;
	}

	try {
		await ctx.editMessageText(screen.text, { reply_markup: markup });
	} catch (error) {
		if (!isUnchangedMessage(error)) {
			throw error;
		}
	}
}

function isUnchangedMessage(error: unknown): boolean {
	return (
		error instanceof Error && error.message.includes("message is not modified")
	);
}
