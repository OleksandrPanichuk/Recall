import {
	Controller,
	Get,
	Param,
	Post,
	Res,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Response } from "express";
import { SessionGuard } from "@/modules/auth";
import { AttachmentEntity } from "./attachment.entity";
import { NoFileSentError } from "./attachments.errors";
import type { UploadedImage } from "./attachments.types";
import { ReadAttachmentUseCase, UploadImageUseCase } from "./use-cases";
import { serveAttachment } from "./utils/serve-attachment";

@ApiExcludeController()
@UseGuards(SessionGuard)
@Controller("app/uploads")
export class AttachmentsController {
	constructor(
		private readonly uploadImage: UploadImageUseCase,
		private readonly readAttachment: ReadAttachmentUseCase,
	) {}

	@Post()
	@UseInterceptors(
		FileInterceptor("file", {
			limits: { fileSize: AttachmentEntity.MAX_BYTES },
		}),
	)
	upload(@UploadedFile() file: UploadedImage | undefined) {
		if (file === undefined) {
			throw new NoFileSentError();
		}

		return this.uploadImage.execute({
			body: file.buffer,
			contentType: file.mimetype,
			originalName: file.originalname,
		});
	}

	@Get(":id")
	async read(
		@Param("id") id: string,
		@Res() response: Response,
	): Promise<void> {
		await serveAttachment(
			response,
			await this.readAttachment.execute({ id }),
			"private, max-age=31536000, immutable",
		);
	}
}
