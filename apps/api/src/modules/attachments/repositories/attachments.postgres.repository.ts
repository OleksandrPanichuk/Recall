import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { OwnerContext } from "@/core/owner-context";
import { Database } from "@/db/connection";
import { DatabaseExecutor } from "@/db/executor";
import { attachments } from "@/db/schema";
import { isUuid } from "@/db/uuid";
import type { AttachmentEntity } from "../attachment.entity";
import { AttachmentsRepository } from "../attachments.repository";

@Injectable()
export class PostgresAttachmentsRepository extends AttachmentsRepository {
	constructor(
		private readonly database: Database,
		private readonly owners: OwnerContext,
	) {
		super();
	}

	private get executor() {
		return DatabaseExecutor.for(this.database.db);
	}

	private get owner() {
		return this.owners.current();
	}

	private get mine() {
		return eq(attachments.ownerId, String(this.owner));
	}

	async save(attachment: AttachmentEntity): Promise<void> {
		await this.executor.insert(attachments).values({
			id: attachment.id,
			ownerId: String(this.owner),
			objectKey: attachment.objectKey,
			contentType: attachment.contentType,
			size: attachment.size,
			originalName: attachment.originalName ?? null,
		});
	}

	async findById(id: string): Promise<AttachmentEntity | undefined> {
		if (!isUuid(id)) {
			return undefined;
		}

		const [row] = await this.executor
			.select()
			.from(attachments)
			.where(and(this.mine, eq(attachments.id, id)))
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
	}
}
