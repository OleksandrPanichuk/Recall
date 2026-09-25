import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import { loginLinkScreen } from "../presenters/login.presenter";
import { render } from "../screen";
import { unlessIdentityUnavailable } from "./utils/identity-unavailable";

export function loginHandler(useCases: TelegramUseCases) {
	return (ctx: Context): Promise<void> =>
		unlessIdentityUnavailable(ctx, async () => {
			const link = await useCases.issueLoginLink.execute({
				telegramUserId: ctx.from?.id ?? 0,
				displayName: ctx.from?.first_name,
			});

			await render(ctx, loginLinkScreen(link.url, new Date(link.expiresAt)));
		});
}
