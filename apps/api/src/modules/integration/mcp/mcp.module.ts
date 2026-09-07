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
import { loadApiEnvironment } from "@/configs/env.config";
import { DatabaseConnection } from "@/db/connection";
import { AuthService } from "@/modules/auth";
import {
	findApiTokenPrincipal,
	looksLikeApiToken,
	touchApiToken,
} from "@/persistence/postgres/api-tokens";
import { createPostgresOAuthStore } from "@/persistence/postgres/oauth.store";
import {
	createPostgresUnitOfWork,
	readOnlyScope,
} from "@/persistence/postgres/unit-of-work";

export const MCP_SURFACE = Symbol("MCP_SURFACE");

export interface McpSurface {
	readonly app?: Express;
}

@Module({
	providers: [
		{
			provide: MCP_SURFACE,
			inject: [DatabaseConnection, AuthService],
			useFactory: (
				connection: DatabaseConnection,
				auth: AuthService,
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
						instanceOwner: () => auth.instanceOwner(),
						sessionOwner: (request) =>
							auth.enabled
								? auth.ownerOfSession(request)
								: Promise.resolve(undefined),
						oauth: createOAuthProvider({
							store: createPostgresOAuthStore(connection.db, () => new Date()),
							staticToken: environment.mcpToken,
							instanceOwner: () => auth.instanceOwner(),
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
