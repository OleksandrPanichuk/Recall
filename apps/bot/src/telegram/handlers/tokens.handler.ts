import { API_TOKEN_NAME_MAX_LENGTH } from "@recall/contracts";
import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import {
	issuedTokenScreen,
	tokenListScreen,
	tokenNameTooLong,
	tokenRevokedScreen,
} from "../presenters/tokens.presenter";
import { render } from "../screen";
import { unlessIdentityUnavailable } from "./utils/identity-unavailable";

export function issueTokenHandler(useCases: TelegramUseCases) {
	return async (ctx: Context, name: string): Promise<void> => {
		if (name.length > API_TOKEN_NAME_MAX_LENGTH) {
			await render(ctx, tokenNameTooLong());

			return;
		}

		await unlessIdentityUnavailable(ctx, async () => {
			const issued = await useCases.issueApiToken.execute({
				telegramUserId: ctx.from?.id ?? 0,
				name,
			});

			await render(ctx, issuedTokenScreen(issued.name, issued.token));
		});
	};
}

export function listTokensHandler(useCases: TelegramUseCases) {
	return (ctx: Context): Promise<void> =>
		unlessIdentityUnavailable(ctx, async () => {
			await render(
				ctx,
				tokenListScreen(
					await useCases.listApiTokens.execute({
						telegramUserId: ctx.from?.id ?? 0,
					}),
				),
			);
		});
}

export function revokeTokenHandler(useCases: TelegramUseCases) {
	return (ctx: Context, tokenId: string): Promise<void> =>
		unlessIdentityUnavailable(ctx, async () => {
			const { revoked } = await useCases.revokeApiToken.execute({
				telegramUserId: ctx.from?.id ?? 0,
				tokenId,
			});

			await render(ctx, tokenRevokedScreen(revoked));
		});
}
