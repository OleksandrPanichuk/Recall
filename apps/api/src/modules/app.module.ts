import { Module } from "@nestjs/common";
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
		BotModule,
		AdminModule,
		McpModule,
	],
	controllers: [HealthController],
})
export class AppModule {}
