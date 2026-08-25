import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { RecallDatabase } from "@/persistence/postgres/client";
import { telegramLink } from "./telegram-link.plugin";

export interface AuthOptions {
	readonly db: RecallDatabase;
	readonly secret: string;
	readonly baseUrl: string;
	readonly successUrl: string;
	readonly trustedOrigins: readonly string[];
}

export type RecallAuth = ReturnType<typeof createAuth>;

export const AUTH_BASE_PATH = "/api/auth";

export function createAuth(options: AuthOptions) {
	return betterAuth({
		database: drizzleAdapter(options.db, { provider: "pg" }),
		secret: options.secret,
		baseURL: options.baseUrl,
		basePath: AUTH_BASE_PATH,
		trustedOrigins: [...options.trustedOrigins],
		// Off until the plan's second auth phase. Enabling it opens
		// POST /sign-up/email to anyone who can reach the api, and this instance
		// admits exactly one person: whoever the bot vouches for.
		emailAndPassword: { enabled: false },
		session: {
			// A year, re-issued on use: the "endless cookie" the owner asked for,
			// but as a session row that can be revoked rather than a standing jwt.
			expiresIn: 60 * 60 * 24 * 365,
			updateAge: 60 * 60 * 24,
		},
		advanced: { useSecureCookies: options.baseUrl.startsWith("https://") },
		plugins: [telegramLink({ successUrl: options.successUrl })],
	});
}
