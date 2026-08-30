import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import { finishPrompt, mainMenu, notice } from "../presenters/menu.presenter";
import { questionScreen } from "../presenters/question.presenter";
import { render } from "../screen";

export function menuHandler(useCases: TelegramUseCases) {
	return async (ctx: Context): Promise<void> => {
		const current = await useCases.getCurrentQuestion.execute({});

		await render(
			ctx,
			mainMenu({
				hasUnfinishedAttempt: current !== undefined,
				awaitingFinish: current?.awaitingFinish === true,
			}),
		);
	};
}

export function resumeHandler(useCases: TelegramUseCases) {
	return async (ctx: Context): Promise<void> => {
		const current = await useCases.getCurrentQuestion.execute({});

		if (current === undefined) {
			await render(
				ctx,
				notice("Немає незавершеної спроби. Оберіть набір у меню."),
			);

			return;
		}

		if (current.question === undefined) {
			await render(ctx, finishPrompt());

			return;
		}

		await render(ctx, questionScreen(current, current.question));
	};
}
