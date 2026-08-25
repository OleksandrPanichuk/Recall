import { Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import type { Express } from "express";
import { createMcpHttpApp } from "@/adapters/mcp/http/app";
import { createOAuthProvider } from "@/adapters/mcp/http/oauth/provider";
import {
	createOAuthDatabase,
	type OAuthDatabase,
} from "@/adapters/persistence/sqlite/oauth-database";
import { createSqliteOAuthStore } from "@/adapters/persistence/sqlite/repositories/sqlite-oauth.store";
import type { ApplicationDependencies } from "@/application/use-case";
import { createUseCases } from "@/composition/create-application";
import { silentLogger } from "@/infrastructure/logging/logger";
import { loadApiEnvironment } from "../../shared/config/api-env";
import { USE_CASE_DEPENDENCIES } from "../../shared/database/tokens";

export const MCP_SURFACE = Symbol("MCP_SURFACE");

export interface McpSurface {
	readonly app?: Express;
	readonly database?: OAuthDatabase;
}

@Module({
	providers: [
		{
			provide: MCP_SURFACE,
			inject: [USE_CASE_DEPENDENCIES],
			useFactory: (dependencies: ApplicationDependencies): McpSurface => {
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
						application: createUseCases(dependencies),
						logger: silentLogger,
						oauth: createOAuthProvider({
							store: createSqliteOAuthStore(
								database.client,
								database.transaction,
								() => new Date(),
							),
							staticToken: environment.mcpToken,
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
