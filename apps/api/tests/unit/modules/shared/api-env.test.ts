import { describe, expect, test } from "bun:test";
import {
	ApiEnvironmentError,
	loadApiEnvironment,
} from "@/modules/shared/config/api-env";

const MINIMAL = { DATABASE_URL: "postgres://recall@127.0.0.1:5432/recall" };
const TOKEN = "t".repeat(32);

const failureOf = (source: Record<string, string | undefined>): string => {
	try {
		loadApiEnvironment(source);
	} catch (error) {
		if (error instanceof ApiEnvironmentError) {
			return error.message;
		}

		throw error;
	}

	throw new Error("the configuration was accepted");
};

describe("the api configuration", () => {
	test("leaves the mcp surface off when no token is given", () => {
		const environment = loadApiEnvironment(MINIMAL);

		expect(environment.mcpToken).toBeUndefined();
		expect(environment.mcpAllowedHosts).toEqual([]);
		expect(environment.port).toBe(8767);
	});

	test("turns the mcp surface on with a token", () => {
		const environment = loadApiEnvironment({
			...MINIMAL,
			MCP_HTTP_TOKEN: TOKEN,
			MCP_HTTP_ALLOWED_HOST: "recall.example.com",
		});

		expect(environment.mcpToken).toBe(TOKEN);
		expect(environment.mcpAllowedHosts).toEqual(["recall.example.com"]);
	});

	test("refuses a token short enough to guess, without echoing it", () => {
		const message = failureOf({ ...MINIMAL, MCP_HTTP_TOKEN: "short" });

		expect(message).toContain("MCP_HTTP_TOKEN");
		expect(message).not.toContain("short");
	});

	test("refuses an issuer without its passphrase", () => {
		expect(
			failureOf({
				...MINIMAL,
				MCP_HTTP_TOKEN: TOKEN,
				MCP_OAUTH_ISSUER: "https://recall.example.com",
			}),
		).toContain("must be set together");
	});

	test("refuses a passphrase without its issuer", () => {
		expect(
			failureOf({
				...MINIMAL,
				MCP_HTTP_TOKEN: TOKEN,
				MCP_OAUTH_PASSPHRASE: "correct horse battery staple",
			}),
		).toContain("must be set together");
	});

	test("takes both together", () => {
		const environment = loadApiEnvironment({
			...MINIMAL,
			MCP_HTTP_TOKEN: TOKEN,
			MCP_OAUTH_ISSUER: "https://recall.example.com",
			MCP_OAUTH_PASSPHRASE: "correct horse battery staple",
		});

		expect(environment.mcpIssuer?.href).toBe("https://recall.example.com/");
		expect(environment.mcpPassphrase).toBe("correct horse battery staple");
	});
});
