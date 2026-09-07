import type { BetterAuthPlugin } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { RecallDatabase } from "@/db/client";
import type { Mailer } from "@/modules/notifications";
import {
	CLIENT_IP_HEADER,
	MIN_PASSWORD_LENGTH,
	RATE_LIMIT_MAX,
	RATE_LIMIT_WINDOW_SECONDS,
	RESET_TOKEN_TTL_SECONDS,
	SESSION_READ_MAX,
	SESSION_READ_WINDOW_SECONDS,
	SIGN_IN_MAX,
	SIGN_IN_WINDOW_SECONDS,
	SIGN_UP_MAX,
	SIGN_UP_WINDOW_SECONDS,
} from "./auth.constants";
import { AuthLetters } from "./auth.letters";

export const AUTH_BASE_PATH = "/api/auth";

export interface CreateAuthOptions {
	readonly db: RecallDatabase;
	readonly secret: string;
	readonly baseUrl: string;
	readonly trustedOrigins: readonly string[];
	readonly signUpsPerHour?: number;
	readonly rateLimit?: boolean;
	readonly mailer: Mailer;
	readonly plugins: readonly BetterAuthPlugin[];
}

export class AuthFactory {
	static create(options: CreateAuthOptions) {
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
				resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
				sendResetPassword: async ({ user, url }) => {
					await options.mailer.send(AuthLetters.resetPassword(user.email, url));
				},
			},
			rateLimit: {
				enabled: options.rateLimit ?? true,
				window: RATE_LIMIT_WINDOW_SECONDS,
				max: RATE_LIMIT_MAX,
				customRules: {
					"/get-session": {
						window: SESSION_READ_WINDOW_SECONDS,
						max: SESSION_READ_MAX,
					},
					"/sign-up/email": {
						window: SIGN_UP_WINDOW_SECONDS,
						max: options.signUpsPerHour ?? SIGN_UP_MAX,
					},
					"/sign-in/email": {
						window: SIGN_IN_WINDOW_SECONDS,
						max: SIGN_IN_MAX,
					},
				},
			},
			session: {
				expiresIn: 60 * 60 * 24 * 365,
				updateAge: 60 * 60 * 24,
			},
			advanced: {
				useSecureCookies: options.baseUrl.startsWith("https://"),
				ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER, "x-forwarded-for"] },
			},
			plugins: [...options.plugins],
		});
	}
}

export type RecallAuth = ReturnType<typeof AuthFactory.create>;
