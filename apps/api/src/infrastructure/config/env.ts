import { z } from "zod";

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export interface Environment {
	readonly telegramBotKey: string;
	readonly allowedTelegramUserId: number;
	readonly databaseUrl: string;
	readonly oauthDatabasePath: string;
	readonly appTimezone: string;
}

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
	DATABASE_URL: requiredText,
	OAUTH_DATABASE_PATH: requiredText.default("./data/oauth.sqlite"),
	APP_TIMEZONE: requiredText.refine(isSupportedTimezone),
});

const issueMessages = {
	TELEGRAM_BOT_KEY: "TELEGRAM_BOT_KEY is required and must not be empty",
	ALLOWED_TELEGRAM_USER_ID:
		"ALLOWED_TELEGRAM_USER_ID must be a positive integer Telegram user id",
	DATABASE_URL:
		"DATABASE_URL is required: the Postgres connection string for the quiz data",
	OAUTH_DATABASE_PATH: "OAUTH_DATABASE_PATH must not be empty when it is set",
	APP_TIMEZONE:
		"APP_TIMEZONE must be a valid IANA time zone such as Europe/Kyiv",
} as const satisfies Record<keyof z.input<typeof environmentSchema>, string>;

const variableNames = Object.keys(
	issueMessages,
) as (keyof typeof issueMessages)[];

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
		databaseUrl: result.data.DATABASE_URL,
		oauthDatabasePath: result.data.OAUTH_DATABASE_PATH,
		appTimezone: result.data.APP_TIMEZONE,
	};
}

export interface AdminEnvironment {
	readonly host: string;
	readonly port: number;
	readonly passphrase: string;
}

const MIN_PASSPHRASE_LENGTH = 16;
const DEFAULT_ADMIN_HOST = "127.0.0.1";
const DEFAULT_ADMIN_PORT = 8766;

const adminSchema = z.object({
	ADMIN_PASSPHRASE: z.string().trim().min(MIN_PASSPHRASE_LENGTH),
	ADMIN_HOST: requiredText.optional(),
	ADMIN_PORT: requiredText
		.regex(/^\d+$/)
		.transform(Number)
		.refine((port) => port > 0 && port < 65536)
		.optional(),
});

const adminIssueMessages = {
	ADMIN_PASSPHRASE: `ADMIN_PASSPHRASE (or MCP_OAUTH_PASSPHRASE) must be at least ${MIN_PASSPHRASE_LENGTH} characters`,
	ADMIN_HOST: "ADMIN_HOST must not be empty when it is set",
	ADMIN_PORT: "ADMIN_PORT must be a port number between 1 and 65535",
} as const satisfies Record<keyof z.input<typeof adminSchema>, string>;

export function loadAdminEnvironment(
	source: EnvironmentSource = Bun.env,
): AdminEnvironment {
	const result = adminSchema.safeParse({
		ADMIN_PASSPHRASE:
			source.ADMIN_PASSPHRASE ?? source.MCP_OAUTH_PASSPHRASE ?? "",
		ADMIN_HOST: source.ADMIN_HOST,
		ADMIN_PORT: source.ADMIN_PORT,
	});

	if (!result.success) {
		const invalid = new Set(
			result.error.issues.map((issue) => String(issue.path[0])),
		);

		throw new EnvironmentError(
			(Object.keys(adminIssueMessages) as (keyof typeof adminIssueMessages)[])
				.filter((name) => invalid.has(name))
				.map((name) => adminIssueMessages[name]),
		);
	}

	return {
		host: result.data.ADMIN_HOST ?? DEFAULT_ADMIN_HOST,
		port: result.data.ADMIN_PORT ?? DEFAULT_ADMIN_PORT,
		passphrase: result.data.ADMIN_PASSPHRASE,
	};
}
