import { Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { silentLogger } from "@recall/kit";
import type { Express } from "express";
import { createMcpHttpApp } from "@/adapters/mcp/http/app";
import { createOAuthProvider } from "@/adapters/mcp/http/oauth/provider";
import {
	createOAuthDatabase,
	type OAuthDatabase,
} from "@/adapters/persistence/sqlite/oauth-database";
import { createSqliteOAuthStore } from "@/adapters/persistence/sqlite/repositories/sqlite-oauth.store";
import {
	createUseCases,
	systemClock,
	uuidGenerator,
} from "@/composition/create-application";
import {
	findApiTokenPrincipal,
	looksLikeApiToken,
	touchApiToken,
} from "@/persistence/postgres/api-tokens";
import type { PostgresConnection } from "@/persistence/postgres/client";
import type { OwnerResolver } from "@/persistence/postgres/lazy-scope";
import {
	createPostgresUnitOfWork,
	readOnlyScope,
} from "@/persistence/postgres/unit-of-work";
import { loadApiEnvironment } from "../../shared/config/api-env";
import { CONNECTION, INSTANCE_OWNER } from "../../shared/database/tokens";

export const MCP_SURFACE = Symbol("MCP_SURFACE");

export interface McpSurface {
	readonly app?: Express;
	readonly database?: OAuthDatabase;
}

@Module({
	providers: [
		{
			provide: MCP_SURFACE,
			inject: [CONNECTION, INSTANCE_OWNER],
			useFactory: (
				connection: PostgresConnection,
				instanceOwner: OwnerResolver,
			): McpSurface => {
				const environment = loadApiEnvironment();

				if (environment.mcpToken === undefined) {
					return {};
				}

				// MCP client credentials are the one thing still on SQLite; phase 7
				// replaces them with Better Auth. Their own file is what lets the quiz
				// data live in Postgres without dragging the OAuth provider along.
				const database = createOAuthDatabase(environment.oauthDatabasePath);

				return {
					database,
					app: createMcpHttpApp({
						// The tools are built for whoever the credential belongs to, so
						// two people with two tokens see two different libraries.
						applicationFor: (owner) =>
							createUseCases({
								unitOfWork: createPostgresUnitOfWork(connection.db, owner),
								scope: readOnlyScope(connection.db, owner),
								clock: systemClock,
								idGenerator: uuidGenerator,
								timezone: process.env.APP_TIMEZONE ?? "UTC",
							}),
						logger: silentLogger,
						oauth: createOAuthProvider({
							store: createSqliteOAuthStore(
								database.client,
								database.transaction,
								() => new Date(),
							),
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
export class McpModule implements OnApplicationShutdown {
	constructor(@Inject(MCP_SURFACE) private readonly surface: McpSurface) {}

	onApplicationShutdown(): void {
		this.surface.database?.close();
	}
}
