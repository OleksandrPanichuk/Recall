import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Logger } from "@recall/kit";
import express, { type Express, type Request, type Response } from "express";
import type { OwnerId } from "@/application/ports/owner";
import type { UseCases } from "@/composition/create-application";
import { createMcpServer } from "../server";
import { matchesToken } from "./bearer";
import { consentPage } from "./oauth/consent";
import {
	CONSENT_PATH,
	OFFLINE_ACCESS,
	type RecallOAuth,
} from "./oauth/provider";

export interface McpHttpAppDependencies {
	// Who approved the consent screen, when a session cookie says so.
	sessionOwner?(request: Request): Promise<OwnerId | undefined>;
	instanceOwner?(): Promise<OwnerId>;
	// Per request, not per process: which quizzes the tools can see depends on
	// whose credential arrived.
	applicationFor(owner: OwnerId): UseCases;
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
		applicationFor,
		logger,
		oauth,
		allowedHosts,
		issuer,
		passphrase,
		sessionOwner,
		instanceOwner,
	} = dependencies;
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

		app.post(CONSENT_PATH, async (request: Request, response: Response) => {
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

			// Whoever is logged in here is who the grant belongs to. With no session
			// it is the instance owner, because knowing the passphrase is what
			// proves that on a single-owner install.
			const target = await oauth.consent.approve(
				id,
				(await sessionOwner?.(request)) ?? (await instanceOwner?.()),
			);

			if (target === undefined) {
				response.status(404).send("Запит на доступ уже використано.");

				return;
			}

			logger.info("granted access to a client", { clientId: pending.clientId });
			response.redirect(target);
		});
	}

	// requireBearerAuth puts what the verifier returned on request.auth, so the
	// owner the token belongs to travels with the request rather than being
	// looked up again here.
	const ownerOf = (request: Request): OwnerId | undefined => {
		const extra = (request as { auth?: { extra?: unknown } }).auth?.extra;
		const owner = (extra as { ownerId?: unknown } | undefined)?.ownerId;

		return typeof owner === "string" ? (owner as OwnerId) : undefined;
	};

	app.all(
		"/mcp",
		requireBearerAuth({ verifier: oauth.provider }),
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
			const server = createMcpServer(applicationFor(owner), { logger });

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
