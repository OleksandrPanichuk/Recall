import { Module } from "@nestjs/common";
import { AppSurfaceController } from "./app-surface.controller";

@Module({ controllers: [AppSurfaceController] })
export class AppSurfaceModule {}
