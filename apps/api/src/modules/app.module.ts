import { Module } from "@nestjs/common";
import { ContentModule } from "./content/content.module";
import { AdminModule } from "./integration/admin/admin.module";
import { McpModule } from "./integration/mcp/mcp.module";
import { DatabaseModule } from "./shared/database/database.module";
import { HealthController } from "./shared/health/health.controller";

@Module({
	imports: [DatabaseModule, ContentModule, AdminModule, McpModule],
	controllers: [HealthController],
})
export class AppModule {}
