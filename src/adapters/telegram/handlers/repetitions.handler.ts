import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import { repetitionsScreen } from "../presenters/repetitions.presenter";
import { render } from "../screen";

export function repetitionsHandler(useCases: TelegramUseCases) {
	return async (ctx: Context): Promise<void> => {
		const telegramUserId = ctx.from?.id ?? 0;
		const [due, leeches] = await Promise.all([
			useCases.listDueRepetitions.execute({ telegramUserId }),
			useCases.listLeeches.execute({ telegramUserId }),
		]);

		await render(ctx, repetitionsScreen(due, leeches));
	};
}
