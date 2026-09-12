import type { AttachmentEntity } from "./attachment.entity";

export abstract class AttachmentsRepository {
	abstract save(attachment: AttachmentEntity): Promise<void>;
	abstract findById(id: string): Promise<AttachmentEntity | undefined>;
}
