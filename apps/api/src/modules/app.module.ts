import { Module } from "@nestjs/common";
import { AppSurfaceModule } from "./app/app-surface.module";
import { AuthModule } from "./auth/auth.module";
import { BotModule } from "./bot/bot.module";
import { ContentModule } from "./content/content.module";
import { AdminModule } from "./integration/admin/admin.module";
import { McpModule } from "./integration/mcp/mcp.module";
import { DatabaseModule } from "./shared/database/database.module";
import { HealthController } from "./shared/health/health.controller";

@Module({
	imports: [
		DatabaseModule,
		AuthModule,
		ContentModule,
		AppSurfaceModule,
		BotModule,
		AdminModule,
		McpModule,
	],
	controllers: [HealthController],
})
export class AppModule {}
