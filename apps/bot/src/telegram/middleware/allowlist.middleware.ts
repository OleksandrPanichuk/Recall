import type { Logger } from "@recall/kit";
import type { Context, MiddlewareFn } from "telegraf";
import { updateTypeOf } from "../utils/describe-update";

export interface AllowlistMiddlewareOptions {
	readonly allowedTelegramUserId: number;
	readonly logger: Logger;
}

export function allowlistMiddleware(
	options: AllowlistMiddlewareOptions,
): MiddlewareFn<Context> {
	return async (ctx, next) => {
		if (ctx.from?.id === options.allowedTelegramUserId) {
			await next();

			return;
		}

		options.logger.warn("rejected an update from an unknown user", {
			telegramUserId: ctx.from?.id,
			update: updateTypeOf(ctx),
		});

		if (ctx.callbackQuery !== undefined) {
			await ctx.answerCbQuery("Доступ заборонено");

			return;
		}

		await ctx.reply("Цей бот приватний.");
	};
}
