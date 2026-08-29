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
		emailAndPassword: { enabled: false },
		session: {
			expiresIn: 60 * 60 * 24 * 365,
			updateAge: 60 * 60 * 24,
		},
		advanced: { useSecureCookies: options.baseUrl.startsWith("https://") },
		plugins: [telegramLink({ successUrl: options.successUrl })],
	});
}
