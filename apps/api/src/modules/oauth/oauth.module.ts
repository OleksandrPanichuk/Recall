import { Module } from "@nestjs/common";
import { OAuthRepository } from "./oauth.repository";
import { PostgresOAuthRepository } from "./repositories/oauth.postgres.repository";

@Module({
	providers: [{ provide: OAuthRepository, useClass: PostgresOAuthRepository }],
	exports: [OAuthRepository],
})
export class OAuthModule {}
