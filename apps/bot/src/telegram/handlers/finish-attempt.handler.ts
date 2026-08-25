import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import { finalResult } from "../presenters/result.presenter";
import { render } from "../screen";

export function finishHandler(useCases: TelegramUseCases) {
	return async (ctx: Context): Promise<void> => {
		const result = await useCases.finishQuizAttempt.execute({
			telegramUserId: ctx.from?.id ?? 0,
		});

		await render(ctx, finalResult(result));
	};
}
