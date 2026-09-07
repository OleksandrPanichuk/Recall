import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import { AttachmentNotFoundError } from "../attachments.errors";
import { AttachmentsRepository } from "../attachments.repository";
import { type ObjectBody, ObjectStore } from "../ports/object-store";

export interface ReadAttachmentUseCaseOptions {
	readonly id: string;
}

type Options = ReadAttachmentUseCaseOptions;
type Result = ObjectBody;

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

		return body;
	}
}
