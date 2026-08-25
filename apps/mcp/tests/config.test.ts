import { describe, expect, test } from "bun:test";
import { BridgeConfigurationError, loadConfiguration } from "../src/config";

const TOKEN = "t".repeat(32);

const failureOf = (source: Record<string, string | undefined>): string[] => {
	try {
		loadConfiguration(source);
	} catch (error) {
		if (error instanceof BridgeConfigurationError) {
			return [...error.problems];
		}

		throw error;
	}

	throw new Error("the configuration was accepted");
};

describe("the bridge configuration", () => {
	test("defaults to the api on its documented port", () => {
		const configuration = loadConfiguration({ MCP_HTTP_TOKEN: TOKEN });

		expect(configuration.endpoint.href).toBe("http://127.0.0.1:8767/mcp");
		expect(configuration.timeoutMs).toBe(120_000);
	});

	test("takes the endpoint from the environment", () => {
		const configuration = loadConfiguration({
			MCP_HTTP_TOKEN: TOKEN,
			RECALL_API_MCP_URL: "https://recall.example.com/mcp",
		});

		expect(configuration.endpoint.href).toBe("https://recall.example.com/mcp");
	});

	test("refuses to start without the api's token", () => {
		expect(failureOf({}).join("\n")).toContain("MCP_HTTP_TOKEN");
	});

	test("refuses a token short enough to guess, without echoing it", () => {
		const problems = failureOf({ MCP_HTTP_TOKEN: "short" }).join("\n");

		expect(problems).toContain("MCP_HTTP_TOKEN");
		expect(problems).not.toContain("short");
	});

	test("refuses an endpoint that is not a url", () => {
		expect(
			failureOf({ MCP_HTTP_TOKEN: TOKEN, RECALL_API_MCP_URL: "nope" }).join(
				"\n",
			),
		).toContain("RECALL_API_MCP_URL");
	});

	test("refuses a timeout that is not a number", () => {
		expect(
			failureOf({ MCP_HTTP_TOKEN: TOKEN, RECALL_MCP_TIMEOUT_MS: "soon" }).join(
				"\n",
			),
		).toContain("RECALL_MCP_TIMEOUT_MS");
	});
});
