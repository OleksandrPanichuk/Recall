import { Injectable } from "@nestjs/common";
import { OwnerContext } from "@/core/owner-context";
import { IdGenerator } from "@/core/ports/id-generator";
import { UseCase } from "@/core/use-case";
import { AttachmentEntity } from "../attachment.entity";
import { UnsupportedImageError } from "../attachments.errors";
import { AttachmentsRepository } from "../attachments.repository";
import { ObjectStore } from "../ports/object-store";

export interface UploadImageUseCaseOptions {
	readonly body: Buffer;
	readonly contentType: string;
	readonly size: number;
	readonly originalName?: string;
}

export interface UploadedImage {
	readonly id: string;
	readonly url: string;
}

type Options = UploadImageUseCaseOptions;
type Result = UploadedImage;

@Injectable()
export class UploadImageUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly attachments: AttachmentsRepository,
		private readonly objects: ObjectStore,
		private readonly owners: OwnerContext,
		private readonly ids: IdGenerator,
	) {
		super();
	}

	async execute({
		body,
		contentType,
		size,
		originalName,
	}: Options): Promise<Result> {
		if (!AttachmentEntity.isAllowedType(contentType)) {
			throw new UnsupportedImageError(contentType);
		}

		const id = this.ids.generate();
		const objectKey = AttachmentEntity.objectKeyFor(
			String(this.owners.current()),
			id,
		);

		await this.objects.put(objectKey, body, contentType);
		await this.attachments.save({
			id,
			objectKey,
			contentType,
			size,
			originalName,
		});

		return { id, url: AttachmentEntity.urlFor(id) };
	}
}
