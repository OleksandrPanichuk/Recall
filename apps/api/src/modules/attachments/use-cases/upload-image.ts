import { Injectable } from "@nestjs/common";
import { OwnerContext } from "@/core/owner-context";
import { IdGenerator } from "@/core/ports/id-generator";
import { UseCase } from "@/core/use-case";
import { AttachmentEntity } from "../attachment.entity";
import {
	UnsupportedImageError,
	UploadQuotaExceededError,
} from "../attachments.errors";
import { AttachmentsRepository } from "../attachments.repository";
import { ObjectStore } from "../ports/object-store";
import { UploadQuota } from "../upload-quota";
import { imageTypeOf } from "../utils/image-type";

export interface UploadImageUseCaseOptions {
	readonly body: Buffer;
	readonly contentType: string;
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
		private readonly quota: UploadQuota,
	) {
		super();
	}

	async execute({ body, contentType, originalName }: Options): Promise<Result> {
		const detected = imageTypeOf(body);

		if (
			detected === undefined ||
			detected !== contentType.trim().toLowerCase() ||
			!AttachmentEntity.isAllowedType(detected)
		) {
			throw new UnsupportedImageError(contentType);
		}

		const used = await this.attachments.totalSize();

		if (used + body.length > this.quota.bytes) {
			throw new UploadQuotaExceededError(this.quota.bytes);
		}

		const id = this.ids.generate();
		const objectKey = AttachmentEntity.objectKeyFor(
			String(this.owners.current()),
			id,
		);

		await this.objects.put(objectKey, body, detected);

		try {
			await this.attachments.save({
				id,
				objectKey,
				contentType: detected,
				size: body.length,
				originalName,
			});
		} catch (error) {
			await this.objects.remove(objectKey).catch(() => undefined);
			throw error;
		}

		return { id, url: AttachmentEntity.urlFor(id) };
	}
}
