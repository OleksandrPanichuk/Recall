import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import { AttachmentNotFoundError } from "../attachments.errors";
import { AttachmentsRepository } from "../attachments.repository";
import type { ServedAttachment } from "../attachments.types";
import { ObjectStore } from "../ports/object-store";

export interface ReadAttachmentUseCaseOptions {
	readonly id: string;
}

type Options = ReadAttachmentUseCaseOptions;
type Result = ServedAttachment;

@Injectable()
export class ReadAttachmentUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly attachments: AttachmentsRepository,
		private readonly objects: ObjectStore,
	) {
		super();
	}

	async execute({ id }: Options): Promise<Result> {
		const attachment = await this.attachments.findById(id);

		if (attachment === undefined) {
			throw new AttachmentNotFoundError(id);
		}

		const body = await this.objects.get(attachment.objectKey);

		if (body === undefined) {
			throw new AttachmentNotFoundError(id);
		}

		return {
			stream: body.stream,
			contentType: attachment.contentType,
			size: body.size,
			originalName: attachment.originalName,
		};
	}
}
