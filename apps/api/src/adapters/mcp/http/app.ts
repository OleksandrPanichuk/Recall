import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Express, type Request, type Response } from "express";
import type { UseCases } from "@/composition/create-application";
import type { Logger } from "@/infrastructure/logging/logger.types";
import { createMcpServer } from "../server";
import { matchesToken } from "./bearer";
import { consentPage } from "./oauth/consent";
import {
	CONSENT_PATH,
	OFFLINE_ACCESS,
	type RecallOAuth,
} from "./oauth/provider";

export interface McpHttpAppDependencies {
	readonly application: UseCases;
	readonly logger: Logger;
	readonly oauth: RecallOAuth;
	readonly allowedHosts: readonly string[];
	readonly issuer?: URL;
	readonly passphrase?: string;
}

export function createMcpHttpApp(
	dependencies: McpHttpAppDependencies,
): Express {
	const { application, logger, oauth, allowedHosts, issuer, passphrase } =
		dependencies;
	const app = express();

	app.use(express.json());
	app.use(express.urlencoded({ extended: false }));

	if (issuer !== undefined && passphrase !== undefined) {
		app.use(
			mcpAuthRouter({
				provider: oauth.provider,
				issuerUrl: issuer,
				baseUrl: issuer,
				scopesSupported: [OFFLINE_ACCESS],
				resourceName: "Recall quiz sets",
			}),
		);

		app.get(CONSENT_PATH, (request: Request, response: Response) => {
			const id = String(request.query.pending ?? "");
			const pending = oauth.consent.pending(id);

			if (pending === undefined) {
				response
					.status(404)
					.send("Запит на доступ не знайдено або прострочено.");

				return;
			}

			response.type("html").send(consentPage(id, pending));
		});

		app.post(CONSENT_PATH, (request: Request, response: Response) => {
			const id = String(request.body?.pending ?? "");
			const offered = String(request.body?.passphrase ?? "");
			const pending = oauth.consent.pending(id);

			if (pending === undefined) {
				response
					.status(404)
					.send("Запит на доступ не знайдено або прострочено.");

				return;
			}

			if (!matchesToken(offered, passphrase)) {
				logger.warn("refused a consent attempt", {
					clientId: pending.clientId,
				});
				response
					.status(401)
					.type("html")
					.send(consentPage(id, pending, true));

				return;
			}

			const target = oauth.consent.approve(id);

			if (target === undefined) {
				response.status(404).send("Запит на доступ уже використано.");

				return;
			}

			logger.info("granted access to a client", { clientId: pending.clientId });
			response.redirect(target);
		});
	}

	app.all(
		"/mcp",
		requireBearerAuth({ verifier: oauth.provider }),
		async (request: Request, response: Response) => {
			const transport = new StreamableHTTPServerTransport({
				sessionIdGenerator: undefined,
				enableJsonResponse: true,
				allowedHosts: [...allowedHosts],
				enableDnsRebindingProtection: allowedHosts.length > 0,
			});
			const server = createMcpServer(application, { logger });

			try {
				await server.connect(transport);
				await transport.handleRequest(request, response, request.body);
			} finally {
				await server.close();
			}
		},
	);

	return app;
}
