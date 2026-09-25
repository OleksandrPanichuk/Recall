import type { ServerResponse } from "node:http";
import { pipeline } from "node:stream/promises";
import { Logger } from "@nestjs/common";
import { AttachmentEntity } from "../attachment.entity";
import type { ServedAttachment } from "../attachments.types";
import { contentDisposition } from "./content-disposition";

const logger = new Logger("attachments");

const isClientAbort = (error: unknown): boolean =>
	typeof error === "object" &&
	error !== null &&
	"code" in error &&
	error.code === "ERR_STREAM_PREMATURE_CLOSE";

export async function serveAttachment(
	response: ServerResponse,
	attachment: ServedAttachment,
	cacheControl: string,
): Promise<void> {
	const renderable = AttachmentEntity.isAllowedType(attachment.contentType);

	response.setHeader("content-type", attachment.contentType);
	response.setHeader("content-length", String(attachment.size));
	response.setHeader("cache-control", cacheControl);
	response.setHeader("x-content-type-options", "nosniff");
	response.setHeader("content-security-policy", "default-src 'none'; sandbox");
	response.setHeader(
		"content-disposition",
		contentDisposition(
			renderable ? "inline" : "attachment",
			attachment.originalName,
		),
	);

	try {
		await pipeline(attachment.stream, response);
	} catch (error) {
		if (response.writableEnded || isClientAbort(error)) {
			return;
		}

		logger.warn(
			`an attachment stream ended early: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
