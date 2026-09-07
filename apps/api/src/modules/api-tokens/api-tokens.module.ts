import { Module } from "@nestjs/common";
import { ApiTokensRepository } from "./api-tokens.repository";
import { ApiTokensService } from "./api-tokens.service";
import { PostgresApiTokensRepository } from "./repositories/api-tokens.postgres.repository";

@Module({
	providers: [
		{ provide: ApiTokensRepository, useClass: PostgresApiTokensRepository },
		ApiTokensService,
	],
	exports: [ApiTokensService, ApiTokensRepository],
})
export class ApiTokensModule {}
