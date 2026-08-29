import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import { notice } from "../presenters/menu.presenter";
import { render } from "../screen";

export function abandonHandler(useCases: TelegramUseCases) {
	return async (ctx: Context): Promise<void> => {
		const { abandoned } = await useCases.abandonQuizAttempt.execute({});

		await render(
			ctx,
			notice(
				abandoned
					? "Спробу скасовано. Тепер можна почати інший набір."
					: "Незавершених спроб немає.",
			),
		);
	};
}
