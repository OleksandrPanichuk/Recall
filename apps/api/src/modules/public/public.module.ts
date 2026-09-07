import { Module } from "@nestjs/common";
import { AttachmentsModule } from "@/modules/attachments";
import { PublicController } from "./public.controller";

@Module({
	imports: [AttachmentsModule],
	controllers: [PublicController],
})
export class PublicModule {}
