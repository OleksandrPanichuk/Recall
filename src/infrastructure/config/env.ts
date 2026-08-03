import { z } from "zod";

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export interface Environment {
	readonly telegramBotKey: string;
	readonly allowedTelegramUserId: number;
	readonly databasePath: string;
	readonly appTimezone: string;
}

/**
 * Startup configuration failure. Carries variable names and reasons only, so a
 * failed startup can be logged without leaking the bot token.
 */
export class EnvironmentError extends Error {
	public readonly issues: readonly string[];

	constructor(issues: readonly string[]) {
		super(
			`Invalid environment configuration:\n${issues
				.map((issue) => `- ${issue}`)
				.join("\n")}`,
		);
		this.name = "EnvironmentError";
		this.issues = issues;
	}
}

function isSupportedTimezone(value: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: value });
	} catch {
		return false;
	}

	return true;
}

const requiredText = z.string().trim().min(1);

const environmentSchema = z.object({
	TELEGRAM_BOT_KEY: requiredText,
	ALLOWED_TELEGRAM_USER_ID: requiredText
		.regex(/^\d+$/)
		.transform(Number)
		.refine((userId) => Number.isSafeInteger(userId) && userId > 0),
	DATABASE_PATH: requiredText,
	APP_TIMEZONE: requiredText.refine(isSupportedTimezone),
});

/**
 * Human-readable reason per variable. Zod issue messages are deliberately not
 * reused: they can echo the received value, and a bot token must never reach a
 * log line.
 */
const issueMessages = {
	TELEGRAM_BOT_KEY: "TELEGRAM_BOT_KEY is required and must not be empty",
	ALLOWED_TELEGRAM_USER_ID:
		"ALLOWED_TELEGRAM_USER_ID must be a positive integer Telegram user id",
	DATABASE_PATH: "DATABASE_PATH is required and must not be empty",
	APP_TIMEZONE:
		"APP_TIMEZONE must be a valid IANA time zone such as Europe/Kyiv",
} as const satisfies Record<keyof z.input<typeof environmentSchema>, string>;

const variableNames = Object.keys(
	issueMessages,
) as (keyof typeof issueMessages)[];

/**
 * Validates the process environment before the application starts. Throws an
 * {@link EnvironmentError} that lists every problem instead of failing on the
 * first one, so a misconfigured setup can be fixed in a single pass.
 */
export function loadEnvironment(
	source: EnvironmentSource = Bun.env,
): Environment {
	const result = environmentSchema.safeParse(source);

	if (!result.success) {
		const invalid = new Set(
			result.error.issues.map((issue) => String(issue.path[0])),
		);

		throw new EnvironmentError(
			variableNames
				.filter((name) => invalid.has(name))
				.map((name) => issueMessages[name]),
		);
	}

	return {
		telegramBotKey: result.data.TELEGRAM_BOT_KEY,
		allowedTelegramUserId: result.data.ALLOWED_TELEGRAM_USER_ID,
		databasePath: result.data.DATABASE_PATH,
		appTimezone: result.data.APP_TIMEZONE,
	};
}
