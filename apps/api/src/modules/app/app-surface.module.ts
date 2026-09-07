import { Module } from "@nestjs/common";
import { ApiTokensModule } from "@/modules/api-tokens";
import { PagesModule } from "@/modules/pages";
import { AppSurfaceController } from "./app-surface.controller";
import { UploadsController } from "./uploads.controller";

@Module({
	imports: [ApiTokensModule, PagesModule],
	controllers: [AppSurfaceController, UploadsController],
})
export class AppSurfaceModule {}
