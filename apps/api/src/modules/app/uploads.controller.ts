import { randomUUID } from "node:crypto";
import {
	BadRequestException,
	Controller,
	Get,
	Inject,
	NotFoundException,
	Param,
	Post,
	Req,
	Res,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Response } from "express";
import type { ObjectStore } from "@/application/ports/object-store";
import { CONNECTION, OBJECT_STORE } from "@/modules/shared/database/tokens";
import type { PostgresConnection } from "@/persistence/postgres/client";
import { scopeFor } from "@/persistence/postgres/unit-of-work";
import { SessionGuard, type SessionRequest } from "./session.guard";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "./uploads.constants";
import type { UploadedImage } from "./uploads.types";

@ApiExcludeController()
@UseGuards(SessionGuard)
@Controller("app/uploads")
export class UploadsController {
	constructor(
		@Inject(CONNECTION)
		private readonly connection: PostgresConnection,
		@Inject(OBJECT_STORE)
		private readonly objects: ObjectStore,
	) {}

	@Post()
	@UseInterceptors(
		FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }),
	)
	async upload(
		@Req() request: SessionRequest,
		@UploadedFile() file: UploadedImage | undefined,
	) {
		if (file === undefined) {
			throw new BadRequestException("no file was sent");
		}

		if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
			throw new BadRequestException(`${file.mimetype} is not an image`);
		}

		const owner = request.owner;

		if (owner === undefined) {
			throw new NotFoundException();
		}

		const id = randomUUID();
		const key = `${String(owner)}/${id}`;

		await this.objects.put(key, file.buffer, file.mimetype);
		await scopeFor(this.connection.db, owner).attachments.save({
			id,
			objectKey: key,
			contentType: file.mimetype,
			size: file.size,
			originalName: file.originalname,
		});

		return { id, url: `/app/uploads/${id}` };
	}

	@Get(":id")
	async read(
		@Req() request: SessionRequest,
		@Param("id") id: string,
		@Res() response: Response,
	): Promise<void> {
		const owner = request.owner;

		if (owner === undefined) {
			throw new NotFoundException();
		}

		const attachment = await scopeFor(
			this.connection.db,
			owner,
		).attachments.findById(id);

		if (attachment === undefined) {
			throw new NotFoundException();
		}

		const body = await this.objects.get(attachment.objectKey);

		if (body === undefined) {
			throw new NotFoundException();
		}

		response.setHeader("content-type", body.contentType);
		response.setHeader("content-length", String(body.size));
		response.setHeader("cache-control", "private, max-age=31536000, immutable");
		body.stream.pipe(response);
	}
}
