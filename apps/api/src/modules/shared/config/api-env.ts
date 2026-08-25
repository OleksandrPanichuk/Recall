import { z } from "zod";

export interface ApiEnvironment {
	readonly databaseUrl: string;
	readonly adminPassphrase?: string;
	readonly allowedTelegramUserId: number;
	readonly adminOrigin?: string;
	readonly oauthDatabasePath: string;
	readonly mcpToken?: string;
	readonly botToken?: string;
	readonly mcpIssuer?: URL;
	readonly mcpPassphrase?: string;
	readonly mcpAllowedHosts: readonly string[];
	readonly host: string;
	readonly port: number;
}

const schema = z.object({
	DATABASE_URL: z.string().trim().min(1),
	ADMIN_PASSPHRASE: z.string().trim().min(16).optional(),
	ALLOWED_TELEGRAM_USER_ID: z.coerce.number().int().positive().default(0),
	ADMIN_ORIGIN: z.string().trim().url().optional(),
	OAUTH_DATABASE_PATH: z.string().trim().min(1).default("./data/oauth.sqlite"),
	MCP_HTTP_TOKEN: z.string().trim().min(32).optional(),
	BOT_API_TOKEN: z.string().trim().min(32).optional(),
	MCP_OAUTH_ISSUER: z.string().trim().url().optional(),
	MCP_OAUTH_PASSPHRASE: z.string().trim().min(16).optional(),
	MCP_HTTP_ALLOWED_HOST: z.string().trim().min(1).optional(),
	API_HOST: z.string().trim().min(1).default("127.0.0.1"),
	API_PORT: z.coerce.number().int().positive().max(65535).default(8767),
});

export class ApiEnvironmentError extends Error {
	constructor(issues: readonly string[]) {
		super(
			`Invalid API configuration:\n${issues.map((i) => `- ${i}`).join("\n")}`,
		);
		this.name = "ApiEnvironmentError";
	}
}

export function loadApiEnvironment(
	source: Readonly<Record<string, string | undefined>> = process.env,
): ApiEnvironment {
	const parsed = schema.safeParse(source);

	if (!parsed.success) {
		throw new ApiEnvironmentError(
			parsed.error.issues.map(
				(issue) => `${issue.path.join(".")}: ${issue.message}`,
			),
		);
	}

	const issuer = parsed.data.MCP_OAUTH_ISSUER;
	const passphrase = parsed.data.MCP_OAUTH_PASSPHRASE;

	if ((issuer === undefined) !== (passphrase === undefined)) {
		throw new ApiEnvironmentError([
			"MCP_OAUTH_ISSUER and MCP_OAUTH_PASSPHRASE must be set together, or neither",
		]);
	}

	return {
		databaseUrl: parsed.data.DATABASE_URL,
		adminPassphrase: parsed.data.ADMIN_PASSPHRASE,
		allowedTelegramUserId: parsed.data.ALLOWED_TELEGRAM_USER_ID,
		adminOrigin: parsed.data.ADMIN_ORIGIN,
		oauthDatabasePath: parsed.data.OAUTH_DATABASE_PATH,
		mcpToken: parsed.data.MCP_HTTP_TOKEN,
		botToken: parsed.data.BOT_API_TOKEN,
		mcpIssuer: issuer === undefined ? undefined : new URL(issuer),
		mcpPassphrase: passphrase,
		mcpAllowedHosts:
			parsed.data.MCP_HTTP_ALLOWED_HOST === undefined
				? []
				: [parsed.data.MCP_HTTP_ALLOWED_HOST],
		host: parsed.data.API_HOST,
		port: parsed.data.API_PORT,
	};
}
