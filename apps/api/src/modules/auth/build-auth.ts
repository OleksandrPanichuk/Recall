import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { RecallDatabase } from "@/persistence/postgres/client";
import {
	MIN_PASSWORD_LENGTH,
	RATE_LIMIT_MAX,
	RATE_LIMIT_WINDOW_SECONDS,
	SIGN_IN_MAX,
	SIGN_IN_WINDOW_SECONDS,
	SIGN_UP_MAX,
	SIGN_UP_WINDOW_SECONDS,
} from "./build-auth.constants";
import { telegramLink } from "./telegram-link.plugin";

export interface AuthOptions {
	readonly db: RecallDatabase;
	readonly secret: string;
	readonly baseUrl: string;
	readonly successUrl: string;
	readonly trustedOrigins: readonly string[];
	readonly signUpsPerHour?: number;
	readonly rateLimit?: boolean;
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
		emailAndPassword: {
			enabled: true,
			minPasswordLength: MIN_PASSWORD_LENGTH,
			autoSignIn: true,
			requireEmailVerification: false,
		},
		rateLimit: {
			enabled: options.rateLimit ?? true,
			window: RATE_LIMIT_WINDOW_SECONDS,
			max: RATE_LIMIT_MAX,
			customRules: {
				"/sign-up/email": {
					window: SIGN_UP_WINDOW_SECONDS,
					max: options.signUpsPerHour ?? SIGN_UP_MAX,
				},
				"/sign-in/email": { window: SIGN_IN_WINDOW_SECONDS, max: SIGN_IN_MAX },
			},
		},
		session: {
			expiresIn: 60 * 60 * 24 * 365,
			updateAge: 60 * 60 * 24,
		},
		advanced: { useSecureCookies: options.baseUrl.startsWith("https://") },
		plugins: [telegramLink({ successUrl: options.successUrl })],
	});
}
