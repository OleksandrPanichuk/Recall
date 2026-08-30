import { isApiError } from "@recall/contracts";
import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import { loginUnavailable } from "../presenters/login.presenter";
import {
	issuedTokenScreen,
	tokenListScreen,
	tokenRevokedScreen,
} from "../presenters/tokens.presenter";
import { render } from "../screen";

const unavailable = async (ctx: Context, error: unknown): Promise<void> => {
	if (isApiError(error) && error.status === 503) {
		await render(ctx, loginUnavailable());

		return;
	}

	throw error;
};

export function issueTokenHandler(useCases: TelegramUseCases) {
	return async (ctx: Context, name: string): Promise<void> => {
		try {
			const issued = await useCases.issueApiToken.execute({
				telegramUserId: ctx.from?.id ?? 0,
				name,
			});

			await render(ctx, issuedTokenScreen(issued.name, issued.token));
		} catch (error) {
			await unavailable(ctx, error);
		}
	};
}

export function listTokensHandler(useCases: TelegramUseCases) {
	return async (ctx: Context): Promise<void> => {
		try {
			await render(
				ctx,
				tokenListScreen(
					await useCases.listApiTokens.execute({
						telegramUserId: ctx.from?.id ?? 0,
					}),
				),
			);
		} catch (error) {
			await unavailable(ctx, error);
		}
	};
}

export function revokeTokenHandler(useCases: TelegramUseCases) {
	return async (ctx: Context, tokenId: string): Promise<void> => {
		try {
			const { revoked } = await useCases.revokeApiToken.execute({
				telegramUserId: ctx.from?.id ?? 0,
				tokenId,
			});

			await render(ctx, tokenRevokedScreen(revoked));
		} catch (error) {
			await unavailable(ctx, error);
		}
	};
}
