import { Module } from "@nestjs/common";
import { silentLogger } from "@recall/kit";
import type { Express } from "express";
import { loadApiEnvironment } from "@/configs/env.config";
import { ApiTokensModule, ApiTokensService } from "@/modules/api-tokens";
import { AttemptsModule } from "@/modules/attempts";
import { AuthService } from "@/modules/auth";
import { InsightsModule } from "@/modules/insights";
import { OAuthModule, OAuthRepository } from "@/modules/oauth";
import { PagesModule } from "@/modules/pages";
import { QuizzesModule } from "@/modules/quizzes";
import { StudySettingsModule } from "@/modules/study-settings";
import { VocabularyModule } from "@/modules/vocabulary";
import { createMcpHttpApp } from "./http/app";
import { createOAuthProvider } from "./http/oauth/provider";
import { McpUseCases } from "./mcp.server.types";

export const MCP_SURFACE = Symbol("MCP_SURFACE");

export interface McpSurface {
	readonly app?: Express;
}

@Module({
	imports: [
		ApiTokensModule,
		AttemptsModule,
		InsightsModule,
		OAuthModule,
		PagesModule,
		QuizzesModule,
		StudySettingsModule,
		VocabularyModule,
	],
	providers: [
		McpUseCases,
		{
			provide: MCP_SURFACE,
			inject: [AuthService, OAuthRepository, ApiTokensService, McpUseCases],
			useFactory: (
				auth: AuthService,
				oauth: OAuthRepository,
				apiTokens: ApiTokensService,
				useCases: McpUseCases,
			): McpSurface => {
				const environment = loadApiEnvironment();

				if (environment.mcpToken === undefined) {
					return {};
				}

				return {
					app: createMcpHttpApp({
						useCases,
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
