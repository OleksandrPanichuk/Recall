import { z } from "zod";

export interface BotEnvironment {
	readonly telegramBotKey: string;
	readonly allowedTelegramUserId: number;
	readonly apiUrl: URL;
	readonly apiToken: string;
	readonly timezone: string;
}

export class BotEnvironmentError extends Error {
	constructor(readonly problems: readonly string[]) {
		super(
			`Invalid bot configuration:\n${problems.map((problem) => `- ${problem}`).join("\n")}`,
		);
		this.name = "BotEnvironmentError";
	}
}

const MIN_TOKEN_LENGTH = 32;
const DEFAULT_API_URL = "http://127.0.0.1:8767";

const supportedTimezone = (value: string): boolean => {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: value });

		return true;
	} catch {
		return false;
	}
};

const schema = z.object({
	TELEGRAM_BOT_KEY: z.string().trim().min(1),
	ALLOWED_TELEGRAM_USER_ID: z.coerce.number().int().positive(),
	RECALL_API_URL: z.string().trim().url().default(DEFAULT_API_URL),
	BOT_API_TOKEN: z.string().trim().min(MIN_TOKEN_LENGTH),
	APP_TIMEZONE: z.string().trim().min(1).refine(supportedTimezone),
});

const messages: Record<keyof z.input<typeof schema>, string> = {
	TELEGRAM_BOT_KEY: "TELEGRAM_BOT_KEY is required",
	ALLOWED_TELEGRAM_USER_ID:
		"ALLOWED_TELEGRAM_USER_ID must be the numeric telegram id allowed to use this bot",
	RECALL_API_URL: `RECALL_API_URL must be the url of the recall api (default ${DEFAULT_API_URL})`,
	BOT_API_TOKEN: `BOT_API_TOKEN is required and must be at least ${MIN_TOKEN_LENGTH} characters — the same token the api was given`,
	APP_TIMEZONE: "APP_TIMEZONE must be a supported IANA timezone",
};

export function loadBotEnvironment(
	source: Readonly<Record<string, string | undefined>> = Bun.env,
): BotEnvironment {
	const parsed = schema.safeParse(source);

	if (!parsed.success) {
		const invalid = new Set(
			parsed.error.issues.map((issue) => String(issue.path[0])),
		);

		throw new BotEnvironmentError(
			(Object.keys(messages) as (keyof typeof messages)[])
				.filter((name) => invalid.has(name))
				.map((name) => messages[name]),
		);
	}

	return {
		telegramBotKey: parsed.data.TELEGRAM_BOT_KEY,
		allowedTelegramUserId: parsed.data.ALLOWED_TELEGRAM_USER_ID,
		apiUrl: new URL(parsed.data.RECALL_API_URL),
		apiToken: parsed.data.BOT_API_TOKEN,
		timezone: parsed.data.APP_TIMEZONE,
	};
}
