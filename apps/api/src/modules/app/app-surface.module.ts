import { Module } from "@nestjs/common";
import { ApiTokensModule } from "@/modules/api-tokens";
import { PagesModule } from "@/modules/pages";
import { SchedulingModule } from "@/modules/scheduling";
import { StudySettingsModule } from "@/modules/study-settings";
import { AppSurfaceController } from "./app-surface.controller";

@Module({
	imports: [
		ApiTokensModule,
		PagesModule,
		SchedulingModule,
		StudySettingsModule,
	],
	controllers: [AppSurfaceController],
})
export class AppSurfaceModule {}
