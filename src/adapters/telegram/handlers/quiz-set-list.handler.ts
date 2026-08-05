import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import type { CallbackAction } from "../callbacks/callback-data";
import { quizSetList } from "../presenters/menu.presenter";
import { render } from "../screen";

export function quizSetListHandler(
	useCases: TelegramUseCases,
	action: typeof CallbackAction.StartSet | typeof CallbackAction.StatisticsFor,
) {
	return async (ctx: Context): Promise<void> => {
		const sets = await useCases.listQuizSets.execute({});

		await render(ctx, quizSetList(sets, action));
	};
}
