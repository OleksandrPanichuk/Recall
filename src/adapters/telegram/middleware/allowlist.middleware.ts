import type { Context, MiddlewareFn } from "telegraf";

/**
 * The MVP serves exactly one person. Anyone else is answered with a flat refusal
 * and never reaches a handler, so no application service ever runs for them.
 */
export function allowlistMiddleware(
	allowedTelegramUserId: number,
): MiddlewareFn<Context> {
	return async (ctx, next) => {
		if (ctx.from?.id === allowedTelegramUserId) {
			await next();

			return;
		}

		if (ctx.callbackQuery !== undefined) {
			await ctx.answerCbQuery("Доступ заборонено");

			return;
		}

		await ctx.reply("Цей бот приватний.");
	};
}
