import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import { repetitionsScreen } from "../presenters/repetitions.presenter";
import { render } from "../screen";

export function repetitionsHandler(useCases: TelegramUseCases) {
	return async (ctx: Context): Promise<void> => {
		const [due, leeches] = await Promise.all([
			useCases.listDueRepetitions.execute({}),
			useCases.listLeeches.execute({}),
		]);

		await render(ctx, repetitionsScreen(due, leeches));
	};
}
