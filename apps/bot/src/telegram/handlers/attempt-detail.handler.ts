import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import type { AttemptDetailCallback } from "../callbacks/callback-data.types";
import { attemptDetailScreen } from "../presenters/attempt-detail.presenter";
import { render } from "../screen";

export function attemptDetailHandler(useCases: TelegramUseCases) {
	return async (
		ctx: Context,
		callback: AttemptDetailCallback,
	): Promise<void> => {
		const detail = await useCases.getAttemptDetail.execute({
			telegramUserId: ctx.from?.id ?? 0,
			attemptId: callback.attemptId,
		});

		await render(ctx, attemptDetailScreen(detail, callback.page ?? 0));
	};
}
