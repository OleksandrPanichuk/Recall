import { Module } from "@nestjs/common";
import { ContentModule } from "./content/content.module";
import { DatabaseModule } from "./shared/database/database.module";
import { HealthController } from "./shared/health/health.controller";

@Module({
	imports: [DatabaseModule, ContentModule],
	controllers: [HealthController],
})
export class AppModule {}
