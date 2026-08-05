import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import { mainMenu, notice } from "../presenters/menu.presenter";
import { questionScreen } from "../presenters/question.presenter";
import { render } from "../screen";

export function menuHandler(useCases: TelegramUseCases) {
	return async (ctx: Context): Promise<void> => {
		const current = await useCases.getCurrentQuestion.execute({
			telegramUserId: ctx.from?.id ?? 0,
		});

		await render(ctx, mainMenu(current !== undefined));
	};
}

/** "Продовжити навчання" — re-renders whatever question the attempt is on. */
export function resumeHandler(useCases: TelegramUseCases) {
	return async (ctx: Context): Promise<void> => {
		const current = await useCases.getCurrentQuestion.execute({
			telegramUserId: ctx.from?.id ?? 0,
		});

		if (current === undefined) {
			await render(
				ctx,
				notice("Немає незавершеної спроби. Оберіть набір у меню."),
			);

			return;
		}

		await render(ctx, questionScreen(current));
	};
}
