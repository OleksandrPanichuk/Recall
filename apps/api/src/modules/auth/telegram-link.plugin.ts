import { createHash, randomBytes } from "node:crypto";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

export const TELEGRAM_PROVIDER = "telegram";
export const LOGIN_IDENTIFIER_PREFIX = "telegram-login:";
export const DEFAULT_LINK_TTL_SECONDS = 300;

export const identifierFor = (token: string): string =>
	`${LOGIN_IDENTIFIER_PREFIX}${createHash("sha256").update(token, "utf8").digest("hex")}`;

export const mintLoginToken = (): string =>
	randomBytes(32).toString("base64url");

export interface TelegramLinkOptions {
	// Where the browser lands once the cookie is set. The token is spent by then,
	// so this url never carries a credential.
	readonly successUrl: string;
	readonly failureUrl?: string;
}

const verifyQuery = z.object({ token: z.string().min(1) });

export const telegramLink = (options: TelegramLinkOptions) => {
	return {
		id: "telegram-link",
		endpoints: {
			// Issuing a link is deliberately NOT an endpoint. A route that turns a
			// telegram id into a session is an authorization bypass the moment it is
			// reachable, and better-auth's SERVER_ONLY only hides an endpoint from
			// the generated client. The api issues links from its own bot surface,
			// behind the bot token; this route only spends a token it did not mint.
			verifyTelegramLogin: createAuthEndpoint(
				"/telegram/verify",
				{ method: "GET", query: verifyQuery, requireHeaders: true },
				async (ctx) => {
					const failed = (reason: string): URL => {
						const url = new URL(options.failureUrl ?? options.successUrl);

						url.searchParams.set("error", reason);

						return url;
					};
					const stored =
						await ctx.context.internalAdapter.consumeVerificationValue(
							identifierFor(ctx.query.token),
						);

					if (stored === null || stored === undefined) {
						throw ctx.redirect(failed("invalid_token").href);
					}

					const user = await ctx.context.internalAdapter.findUserById(
						stored.value,
					);

					if (user === null || user === undefined) {
						throw ctx.redirect(failed("unknown_user").href);
					}

					const session = await ctx.context.internalAdapter.createSession(
						user.id,
					);

					if (session === null || session === undefined) {
						throw ctx.redirect(failed("session_failed").href);
					}

					await setSessionCookie(ctx, { session, user });

					throw ctx.redirect(options.successUrl);
				},
			),
		},
		rateLimit: [
			{
				pathMatcher: (path: string) => path.startsWith("/telegram/verify"),
				window: 60,
				max: 10,
			},
		],
	} satisfies BetterAuthPlugin;
};
