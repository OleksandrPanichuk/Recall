import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Logger } from "@recall/kit";
import express, { type Express, type Request, type Response } from "express";
import type { OwnerId } from "@/core/owner";
import { runAs } from "@/shared/request-context";
import { createMcpServer } from "../mcp.server";
import type { McpUseCases } from "../mcp.server.types";
import { matchesToken } from "./bearer";

import { consentPage } from "./oauth/consent";
import {
	CONSENT_PATH,
	OFFLINE_ACCESS,
	type RecallOAuth,
} from "./oauth/provider";

const MCP_PATH = "/mcp";
const MCP_BODY_LIMIT = "2mb";
const NOT_FOUND = "That access request was not found, or it has expired.";

const refuseFraming = (response: Response): Response =>
	response
		.set("x-frame-options", "DENY")
		.set("content-security-policy", "frame-ancestors 'none'");

const addressOf = (request: Request): string =>
	request.ip ?? request.socket.remoteAddress ?? "unknown";

export interface McpHttpAppDependencies {
	sessionOwner?(request: Request): Promise<OwnerId | undefined>;
	instanceOwner?(): Promise<OwnerId>;
	readonly useCases: McpUseCases;
	readonly logger: Logger;
	readonly oauth: RecallOAuth;
	readonly allowedHosts: readonly string[];
	readonly issuer?: URL;
	readonly passphrase?: string;
}

export function createMcpHttpApp(
	dependencies: McpHttpAppDependencies,
): Express {
	const {
		useCases,
		logger,
		oauth,
		allowedHosts,
		issuer,
		passphrase,
		sessionOwner,
		instanceOwner,
	} = dependencies;
	const app = express();

	if (issuer !== undefined && passphrase !== undefined) {
		app.use(
			mcpAuthRouter({
				provider: oauth.provider,
				issuerUrl: issuer,
				baseUrl: issuer,
				resourceServerUrl: new URL(MCP_PATH, issuer),
				scopesSupported: [OFFLINE_ACCESS],
				resourceName: "Recall quiz sets",
			}),
		);

		app.get(
			"/.well-known/oauth-protected-resource",
			(_request: Request, response: Response) => {
				response.redirect(
					308,
					`/.well-known/oauth-protected-resource${MCP_PATH}`,
				);
			},
		);

		const sameOrigin = (request: Request): boolean =>
			request.get("origin") === issuer.origin;

		app.get(CONSENT_PATH, async (request: Request, response: Response) => {
			const id = String(request.query.pending ?? "");
			const pending = oauth.consent.pending(id);

			refuseFraming(response);

			if (pending === undefined) {
				response.status(404).send(NOT_FOUND);

				return;
			}

			const signedIn =
				(await sessionOwner?.(request).catch(() => undefined)) !== undefined;

			response.type("html").send(consentPage(id, pending, { signedIn }));
		});

		app.post(
			CONSENT_PATH,
			express.urlencoded({ extended: false }),
			async (request: Request, response: Response) => {
				const id = String(request.body?.pending ?? "");
				const offered = String(request.body?.passphrase ?? "");
				const address = addressOf(request);

				refuseFraming(response);

				const pending = oauth.consent.pending(id);

				if (pending === undefined) {
					response.status(404).send(NOT_FOUND);

					return;
				}

				const session = await sessionOwner?.(request);
				const vouched = session !== undefined && sameOrigin(request);

				if (!vouched && oauth.consent.throttled(address)) {
					logger.warn("throttled consent attempts", { address });
					response
						.status(429)
						.send("Too many wrong passphrases. Try again later.");

					return;
				}

				if (!vouched && !matchesToken(offered, passphrase)) {
					const open = oauth.consent.refuse(id, address);

					logger.warn("refused a consent attempt", {
						clientId: pending.clientId,
					});

					if (!open) {
						response
							.status(403)
							.send(
								"Too many wrong passphrases. This access request was cancelled; start again from your client.",
							);

						return;
					}

					response
						.status(401)
						.type("html")
						.send(consentPage(id, pending, { failed: true }));

					return;
				}

				const target = await oauth.consent.approve(
					id,
					session ?? (await instanceOwner?.()),
				);

				if (target === undefined) {
					response
						.status(404)
						.send("That access request has already been used.");

					return;
				}

				logger.info("granted access to a client", {
					clientId: pending.clientId,
				});
				response.redirect(target);
			},
		);
	}

	const ownerOf = (request: Request): OwnerId | undefined => {
		const extra = (request as { auth?: { extra?: unknown } }).auth?.extra;
		const owner = (extra as { ownerId?: unknown } | undefined)?.ownerId;

		return typeof owner === "string" ? (owner as OwnerId) : undefined;
	};

	app.all(
		MCP_PATH,
		requireBearerAuth({
			verifier: oauth.provider,
			...(issuer === undefined
				? {}
				: {
						resourceMetadataUrl: new URL(
							`/.well-known/oauth-protected-resource${MCP_PATH}`,
							issuer,
						).href,
					}),
		}),
		express.json({ limit: MCP_BODY_LIMIT }),
		async (request: Request, response: Response) => {
			const owner = ownerOf(request);

			if (owner === undefined) {
				response.status(403).json({
					error: "no_owner",
					error_description: "that credential is not tied to an account",
				});

				return;
			}

			const transport = new StreamableHTTPServerTransport({
				sessionIdGenerator: undefined,
				enableJsonResponse: true,
				allowedHosts: [...allowedHosts],
				enableDnsRebindingProtection: allowedHosts.length > 0,
			});
			const server = createMcpServer(useCases, { logger });

			try {
				await server.connect(transport);
				await runAs({ kind: "static-mcp", owner }, () =>
					transport.handleRequest(request, response, request.body),
				);
			} finally {
				await server.close();
			}
		},
	);

	return app;
}
