import { Module } from "@nestjs/common";
import { loadApiEnvironment } from "@/configs/env.config";
import { AdminModule } from "@/modules/admin/admin.module";
import { ApiTokensModule } from "@/modules/api-tokens";
import { AttachmentsModule } from "@/modules/attachments";
import { AttemptsModule } from "@/modules/attempts";
import { AuthModule } from "@/modules/auth";
import { InsightsModule } from "@/modules/insights";
import { McpModule } from "@/modules/mcp/mcp.module";
import { OAuthModule } from "@/modules/oauth";
import { PageSharesModule } from "@/modules/page-shares";
import { PagesModule } from "@/modules/pages";
import { PracticeModule } from "@/modules/practice";
import { QuizzesModule } from "@/modules/quizzes";
import { SchedulingModule } from "@/modules/scheduling";
import { StatisticsModule } from "@/modules/statistics";
import { StudySettingsModule } from "@/modules/study-settings";
import { TelegramLinkModule, telegramLink } from "@/modules/telegram-link";
import { UsersModule } from "@/modules/users";
import { VocabularyModule } from "@/modules/vocabulary";
import { CoreModule } from "@/shared/core.module";
import { DatabaseModule } from "./shared/database/database.module";
import { HealthController } from "./shared/health/health.controller";

@Module({
	imports: [
		CoreModule,
		DatabaseModule,
		UsersModule,
		AuthModule.forRoot({
			plugins: () => [
				telegramLink({ successUrl: loadApiEnvironment().authSuccessUrl }),
			],
		}),
		TelegramLinkModule,
		ApiTokensModule,
		AttachmentsModule,
		AttemptsModule,
		StatisticsModule,
		PracticeModule,
		InsightsModule,
		OAuthModule,
		PagesModule,
		QuizzesModule,
		VocabularyModule,
		StudySettingsModule,
		SchedulingModule,
		PageSharesModule,
		AdminModule,
		McpModule,
	],
	controllers: [HealthController],
})
export class AppModule {}
