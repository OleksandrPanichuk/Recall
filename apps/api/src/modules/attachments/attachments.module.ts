import { Module } from "@nestjs/common";
import { MinioObjectStore } from "@/adapters/storage/minio.object-store";
import { loadApiEnvironment } from "@/configs/env.config";
import { AttachmentsController } from "./attachments.controller";
import { AttachmentsRepository } from "./attachments.repository";
import { ObjectStore } from "./ports/object-store";
import { PostgresAttachmentsRepository } from "./repositories/attachments.postgres.repository";
import { UploadQuota } from "./upload-quota";
import { ReadAttachmentUseCase, UploadImageUseCase } from "./use-cases";

@Module({
	controllers: [AttachmentsController],
	providers: [
		{
			provide: AttachmentsRepository,
			useClass: PostgresAttachmentsRepository,
		},
		{
			provide: ObjectStore,
			useFactory: (): ObjectStore => {
				const environment = loadApiEnvironment();

				return new MinioObjectStore({
					endpoint: environment.objectStoreEndpoint,
					accessKey: environment.objectStoreAccessKey,
					secretKey: environment.objectStoreSecretKey,
					bucket: environment.objectStoreBucket,
				});
			},
		},
		{
			provide: UploadQuota,
			useFactory: (): UploadQuota =>
				new UploadQuota(loadApiEnvironment().uploadQuotaBytes),
		},
		UploadImageUseCase,
		ReadAttachmentUseCase,
	],
	exports: [AttachmentsRepository, ObjectStore, ReadAttachmentUseCase],
})
export class AttachmentsModule {}
