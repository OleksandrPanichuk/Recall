import { and, eq } from "drizzle-orm";
import type { OwnerId } from "@/application/ports/owner";
import type {
	Attachment,
	AttachmentRepository,
} from "@/application/ports/repositories/attachment.repository";
import { attachments } from "../schema";
import type { Executor } from "../unit-of-work";
import { isUuid } from "../uuid";

export function createAttachmentPostgresRepository(
	executor: Executor,
	owner: OwnerId,
): AttachmentRepository {
	const mine = eq(attachments.ownerId, String(owner));

	return {
		async save(attachment: Attachment): Promise<void> {
			await executor.insert(attachments).values({
				id: attachment.id,
				ownerId: String(owner),
				objectKey: attachment.objectKey,
				contentType: attachment.contentType,
				size: attachment.size,
				originalName: attachment.originalName ?? null,
			});
		},

		async findById(id: string): Promise<Attachment | undefined> {
			if (!isUuid(id)) {
				return undefined;
			}

			const [row] = await executor
				.select()
				.from(attachments)
				.where(and(mine, eq(attachments.id, id)))
				.limit(1);

			return row === undefined
				? undefined
				: {
						id: row.id,
						objectKey: row.objectKey,
						contentType: row.contentType,
						size: row.size,
						originalName: row.originalName ?? undefined,
					};
		},
	};
}
