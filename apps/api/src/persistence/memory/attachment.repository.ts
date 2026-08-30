import type {
	Attachment,
	AttachmentRepository,
} from "@/application/ports/repositories/attachment.repository";
import type { MemoryStore } from "./store";

export function createMemoryAttachmentRepository(
	store: MemoryStore,
): AttachmentRepository {
	return {
		async save(attachment: Attachment): Promise<void> {
			store.files.set(attachment.id, attachment);
		},

		async findById(id: string): Promise<Attachment | undefined> {
			return store.files.get(id);
		},
	};
}
