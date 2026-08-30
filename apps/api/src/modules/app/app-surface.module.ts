import { Module } from "@nestjs/common";
import { AppSurfaceController } from "./app-surface.controller";
import { UploadsController } from "./uploads.controller";

@Module({ controllers: [AppSurfaceController, UploadsController] })
export class AppSurfaceModule {}
