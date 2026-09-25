import { Module } from "@nestjs/common";
import { ApiTokensAppController } from "./api-tokens.app.controller";
import { ApiTokensBotController } from "./api-tokens.bot.controller";
import {
	ApiTokenCredentials,
	ApiTokensRepository,
} from "./api-tokens.repository";
import { ApiTokensService } from "./api-tokens.service";
import {
	PostgresApiTokenCredentials,
	PostgresApiTokensRepository,
} from "./repositories/api-tokens.postgres.repository";

@Module({
	controllers: [ApiTokensAppController, ApiTokensBotController],
	providers: [
		{ provide: ApiTokensRepository, useClass: PostgresApiTokensRepository },
		{ provide: ApiTokenCredentials, useClass: PostgresApiTokenCredentials },
		ApiTokensService,
	],
	exports: [ApiTokensService],
})
export class ApiTokensModule {}
