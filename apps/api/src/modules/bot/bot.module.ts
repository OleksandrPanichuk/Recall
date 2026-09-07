import { Module } from "@nestjs/common";
import { ApiTokensModule } from "@/modules/api-tokens";
import { AttemptsModule } from "@/modules/attempts";
import { PagesModule } from "@/modules/pages";
import { SchedulingModule } from "@/modules/scheduling";
import { StudySettingsModule } from "@/modules/study-settings";
import { TelegramLinkModule } from "@/modules/telegram-link";
import { BotController } from "./bot.controller";
import { botUseCases } from "./use-cases.providers";

@Module({
	imports: [
		ApiTokensModule,
		AttemptsModule,
		PagesModule,
		SchedulingModule,
		StudySettingsModule,
		TelegramLinkModule,
	],
	controllers: [BotController],
	providers: [...botUseCases],
})
export class BotModule {}
