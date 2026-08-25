import { isApiError } from "@recall/contracts";
import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import {
	loginLinkScreen,
	loginUnavailable,
} from "../presenters/login.presenter";
import { render } from "../screen";

export function loginHandler(useCases: TelegramUseCases) {
	return async (ctx: Context): Promise<void> => {
		const telegramUserId = ctx.from?.id ?? 0;

		try {
			const link = await useCases.issueLoginLink.execute({
				telegramUserId,
				displayName: ctx.from?.first_name,
			});

			await render(ctx, loginLinkScreen(link.url, new Date(link.expiresAt)));
		} catch (error) {
			if (isApiError(error) && error.status === 503) {
				await render(ctx, loginUnavailable());

				return;
			}

			throw error;
		}
	};
}
