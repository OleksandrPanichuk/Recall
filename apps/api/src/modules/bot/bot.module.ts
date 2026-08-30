import { Module } from "@nestjs/common";
import { BotController } from "./bot.controller";
import { botUseCases } from "./use-cases.providers";

@Module({
	controllers: [BotController],
	providers: [...botUseCases],
})
export class BotModule {}
