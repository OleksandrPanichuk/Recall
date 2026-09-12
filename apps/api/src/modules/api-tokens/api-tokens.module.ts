import { Module } from "@nestjs/common";
import { ApiTokensAppController } from "./api-tokens.app.controller";
import { ApiTokensBotController } from "./api-tokens.bot.controller";
import { ApiTokensRepository } from "./api-tokens.repository";
import { ApiTokensService } from "./api-tokens.service";
import { PostgresApiTokensRepository } from "./repositories/api-tokens.postgres.repository";

@Module({
	controllers: [ApiTokensAppController, ApiTokensBotController],
	providers: [
		{ provide: ApiTokensRepository, useClass: PostgresApiTokensRepository },
		ApiTokensService,
	],
	exports: [ApiTokensService, ApiTokensRepository],
})
export class ApiTokensModule {}
