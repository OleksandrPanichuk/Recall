import type {
	AttachmentEntity,
	AttachmentsRepository,
} from "@/modules/attachments";
import type { MemoryStore } from "./store";

export function createMemoryAttachmentRepository(
	store: MemoryStore,
): AttachmentsRepository {
	return {
		async save(attachment: AttachmentEntity): Promise<void> {
			store.files.set(attachment.id, attachment);
		},

		async findById(id: string): Promise<AttachmentEntity | undefined> {
			return store.files.get(id);
		},

		async totalSize(): Promise<number> {
			return [...store.files.values()].reduce(
				(total, attachment) => total + attachment.size,
				0,
			);
		},
	};
}
