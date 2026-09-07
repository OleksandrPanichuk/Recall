import { Module } from "@nestjs/common";
import { ApiTokensModule } from "@/modules/api-tokens";
import { TelegramLinkModule } from "@/modules/telegram-link";
import { BotController } from "./bot.controller";
import { botUseCases } from "./use-cases.providers";

@Module({
	imports: [ApiTokensModule, TelegramLinkModule],
	controllers: [BotController],
	providers: [...botUseCases],
})
export class BotModule {}
