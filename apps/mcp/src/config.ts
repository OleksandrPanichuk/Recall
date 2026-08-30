export interface BridgeConfiguration {
	readonly endpoint: URL;
	readonly token: string;
	readonly timeoutMs: number;
}

export class BridgeConfigurationError extends Error {
	constructor(readonly problems: readonly string[]) {
		super(problems.join("\n"));
		this.name = "BridgeConfigurationError";
	}
}

const DEFAULT_ENDPOINT = "http://127.0.0.1:8767/mcp";
const DEFAULT_TIMEOUT_MS = 120_000;
const MIN_TOKEN_LENGTH = 32;

export function loadConfiguration(
	source: Record<string, string | undefined>,
): BridgeConfiguration {
	const problems: string[] = [];
	const raw = source.RECALL_API_MCP_URL?.trim() ?? DEFAULT_ENDPOINT;
	const token = source.MCP_HTTP_TOKEN?.trim() ?? "";

	if (!URL.canParse(raw)) {
		problems.push(
			"RECALL_API_MCP_URL must be the url of the api's /mcp endpoint",
		);
	}

	if (token.length < MIN_TOKEN_LENGTH) {
		problems.push(
			`MCP_HTTP_TOKEN is required and must be at least ${MIN_TOKEN_LENGTH} characters — it is the same token the api was given`,
		);
	}

	const timeout = source.RECALL_MCP_TIMEOUT_MS?.trim();

	if (timeout !== undefined && !/^\d+$/.test(timeout)) {
		problems.push(
			"RECALL_MCP_TIMEOUT_MS must be a whole number of milliseconds",
		);
	}

	if (problems.length > 0) {
		throw new BridgeConfigurationError(problems);
	}

	return {
		endpoint: new URL(raw),
		token,
		timeoutMs: timeout === undefined ? DEFAULT_TIMEOUT_MS : Number(timeout),
	};
}
