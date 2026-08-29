import { Module } from "@nestjs/common";
import { silentLogger } from "@recall/kit";
import type { Express } from "express";
import { createMcpHttpApp } from "@/adapters/mcp/http/app";
import { createOAuthProvider } from "@/adapters/mcp/http/oauth/provider";
import {
	createUseCases,
	systemClock,
	uuidGenerator,
} from "@/composition/create-application";
import type { RecallAuth } from "@/modules/auth/build-auth";
import { ownerOfSession } from "@/modules/auth/session-owner";
import { AUTH } from "@/modules/auth/tokens";
import {
	findApiTokenPrincipal,
	looksLikeApiToken,
	touchApiToken,
} from "@/persistence/postgres/api-tokens";
import type { PostgresConnection } from "@/persistence/postgres/client";
import type { OwnerResolver } from "@/persistence/postgres/lazy-scope";
import { createPostgresOAuthStore } from "@/persistence/postgres/oauth.store";
import {
	createPostgresUnitOfWork,
	readOnlyScope,
} from "@/persistence/postgres/unit-of-work";
import { loadApiEnvironment } from "../../shared/config/api-env";
import { CONNECTION, INSTANCE_OWNER } from "../../shared/database/tokens";

export const MCP_SURFACE = Symbol("MCP_SURFACE");

export interface McpSurface {
	readonly app?: Express;
}

@Module({
	providers: [
		{
			provide: MCP_SURFACE,
			inject: [CONNECTION, INSTANCE_OWNER, AUTH],
			useFactory: (
				connection: PostgresConnection,
				instanceOwner: OwnerResolver,
				auth: RecallAuth | undefined,
			): McpSurface => {
				const environment = loadApiEnvironment();

				if (environment.mcpToken === undefined) {
					return {};
				}

				return {
					app: createMcpHttpApp({
						applicationFor: (owner) =>
							createUseCases({
								unitOfWork: createPostgresUnitOfWork(connection.db, owner),
								scope: readOnlyScope(connection.db, owner),
								clock: systemClock,
								idGenerator: uuidGenerator,
								timezone: process.env.APP_TIMEZONE ?? "UTC",
							}),
						logger: silentLogger,
						instanceOwner,
						sessionOwner: (request) =>
							auth === undefined
								? Promise.resolve(undefined)
								: ownerOfSession(auth, request),
						oauth: createOAuthProvider({
							store: createPostgresOAuthStore(connection.db, () => new Date()),
							staticToken: environment.mcpToken,
							instanceOwner,
							personalToken: async (token) => {
								if (!looksLikeApiToken(token)) {
									return undefined;
								}

								const principal = await findApiTokenPrincipal(
									connection.db,
									token,
									new Date(),
								);

								if (principal === undefined) {
									return undefined;
								}

								await touchApiToken(
									connection.db,
									principal.tokenId,
									new Date(),
								);

								return {
									owner: principal.owner,
									scopes: principal.scopes,
									expiresAt: principal.expiresAt,
									tokenId: principal.tokenId,
								};
							},
							now: () => new Date(),
						}),
						allowedHosts: environment.mcpAllowedHosts,
						issuer: environment.mcpIssuer,
						passphrase: environment.mcpPassphrase,
					}),
				};
			},
		},
	],
	exports: [MCP_SURFACE],
})
export class McpModule {}
