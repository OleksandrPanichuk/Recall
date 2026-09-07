import { Module } from "@nestjs/common";
import { ApiTokensModule } from "@/modules/api-tokens";
import { AttemptsModule } from "@/modules/attempts";
import { InsightsModule } from "@/modules/insights";
import { PagesModule } from "@/modules/pages";
import { PracticeModule } from "@/modules/practice";
import { SchedulingModule } from "@/modules/scheduling";
import { StatisticsModule } from "@/modules/statistics";
import { StudySettingsModule } from "@/modules/study-settings";
import { TelegramLinkModule } from "@/modules/telegram-link";
import { BotController } from "./bot.controller";
import { botUseCases } from "./use-cases.providers";

@Module({
	imports: [
		ApiTokensModule,
		AttemptsModule,
		StatisticsModule,
		PracticeModule,
		InsightsModule,
		PagesModule,
		SchedulingModule,
		StudySettingsModule,
		TelegramLinkModule,
	],
	controllers: [BotController],
	providers: [...botUseCases],
})
export class BotModule {}
