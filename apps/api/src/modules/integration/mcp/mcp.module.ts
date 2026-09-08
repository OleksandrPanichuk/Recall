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
import { ApiTokensModule, ApiTokensService } from "@/modules/api-tokens";
import { AuthService } from "@/modules/auth";
import { OAuthModule, OAuthRepository } from "@/modules/oauth";
import {
	createPostgresUnitOfWork,
	readOnlyScope,
} from "@/persistence/postgres/unit-of-work";

export const MCP_SURFACE = Symbol("MCP_SURFACE");

export interface McpSurface {
	readonly app?: Express;
}

@Module({
	imports: [ApiTokensModule, OAuthModule],
	providers: [
		{
			provide: MCP_SURFACE,
			inject: [
				DatabaseConnection,
				AuthService,
				OAuthRepository,
				ApiTokensService,
			],
			useFactory: (
				connection: DatabaseConnection,
				auth: AuthService,
				oauth: OAuthRepository,
				apiTokens: ApiTokensService,
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
							store: oauth,
							staticToken: environment.mcpToken,
							instanceOwner: () => auth.instanceOwner(),
							personalToken: (token) => apiTokens.principalFor(token),
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
