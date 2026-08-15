import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import { repetitionsScreen } from "../presenters/repetitions.presenter";
import { render } from "../screen";

export function repetitionsHandler(useCases: TelegramUseCases) {
	return async (ctx: Context): Promise<void> => {
		const due = await useCases.listDueRepetitions.execute({
			telegramUserId: ctx.from?.id ?? 0,
		});

		await render(ctx, repetitionsScreen(due));
	};
}
