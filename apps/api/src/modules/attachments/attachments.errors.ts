import { HttpStatus } from "@nestjs/common";
import { ModuleError } from "@/core/errors";

export class UnsupportedImageError extends ModuleError {
	readonly status = HttpStatus.BAD_REQUEST;
	readonly code = "UNSUPPORTED_IMAGE";

	constructor(contentType: string) {
		super(`${contentType} is not an image`);
	}
}

export class NoFileSentError extends ModuleError {
	readonly status = HttpStatus.BAD_REQUEST;
	readonly code = "NO_FILE_SENT";

	constructor() {
		super("no file was sent");
	}
}

export class AttachmentNotFoundError extends ModuleError {
	readonly status = HttpStatus.NOT_FOUND;
	readonly code = "ATTACHMENT_NOT_FOUND";

	constructor(id: string) {
		super(`Attachment ${id} does not exist`);
	}
}
