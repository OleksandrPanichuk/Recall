import { Module } from "@nestjs/common";
import { loadApiEnvironment } from "@/configs/env.config";
import { ApiTokensModule } from "@/modules/api-tokens";
import { AttachmentsModule } from "@/modules/attachments";
import { AuthModule } from "@/modules/auth";
import { OAuthModule } from "@/modules/oauth";
import { PagesModule } from "@/modules/pages";
import { QuizzesModule } from "@/modules/quizzes";
import { TelegramLinkModule, telegramLink } from "@/modules/telegram-link";
import { UsersModule } from "@/modules/users";
import { VocabularyModule } from "@/modules/vocabulary";
import { CoreModule } from "@/shared/core.module";
import { AppSurfaceModule } from "./app/app-surface.module";
import { BotModule } from "./bot/bot.module";
import { ContentModule } from "./content/content.module";
import { AdminModule } from "./integration/admin/admin.module";
import { McpModule } from "./integration/mcp/mcp.module";
import { PublicModule } from "./public/public.module";
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
		OAuthModule,
		PagesModule,
		QuizzesModule,
		VocabularyModule,
		ContentModule,
		AppSurfaceModule,
		PublicModule,
		BotModule,
		AdminModule,
		McpModule,
	],
	controllers: [HealthController],
})
export class AppModule {}
