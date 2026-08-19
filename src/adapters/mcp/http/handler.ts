import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Application } from "@/composition/create-application";
import type { Logger } from "@/infrastructure/logging/logger.types";
import { createMcpServer } from "../server";
import { bearerTokenOf, matchesToken } from "./bearer";

const PATH = "/mcp";
const METHODS = new Set(["POST", "GET", "DELETE"]);

export interface McpHttpHandlerDependencies {
	readonly application: Application;
	readonly logger: Logger;
	readonly token: string;
	readonly allowedHosts: readonly string[];
}

export function createMcpHttpHandler(
	dependencies: McpHttpHandlerDependencies,
): (request: Request) => Promise<Response> {
	const { application, logger, token, allowedHosts } = dependencies;

	const unauthorised = (request: Request, reason: string): Response => {
		logger.warn("refused an unauthorised mcp request", {
			reason,
			method: request.method,
			path: new URL(request.url).pathname,
		});

		return new Response(null, {
			status: 401,
			headers: { "www-authenticate": 'Bearer realm="recall-quiz"' },
		});
	};

	return async (request: Request): Promise<Response> => {
		if (new URL(request.url).pathname !== PATH) {
			return new Response(null, { status: 404 });
		}

		if (!METHODS.has(request.method)) {
			return new Response(null, { status: 405 });
		}

		const presented = bearerTokenOf(request.headers.get("authorization"));

		if (presented === undefined) {
			return unauthorised(request, "no bearer token");
		}

		if (!matchesToken(presented, token)) {
			return unauthorised(request, "token did not match");
		}

		const transport = new WebStandardStreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true,
			allowedHosts: [...allowedHosts],
			enableDnsRebindingProtection: allowedHosts.length > 0,
		});
		const server = createMcpServer(application, { logger });

		try {
			await server.connect(transport);

			return await transport.handleRequest(request);
		} finally {
			await server.close();
		}
	};
}
