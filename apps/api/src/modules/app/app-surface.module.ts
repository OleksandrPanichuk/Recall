import { Module } from "@nestjs/common";
import { ApiTokensModule } from "@/modules/api-tokens";
import { AppSurfaceController } from "./app-surface.controller";
import { UploadsController } from "./uploads.controller";

@Module({
	imports: [ApiTokensModule],
	controllers: [AppSurfaceController, UploadsController],
})
export class AppSurfaceModule {}
