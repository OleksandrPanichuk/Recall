import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { type OwnerId, toOwnerId } from "@/core/owner";
import { OwnerContext } from "@/core/owner-context";
import { Database } from "@/db/connection";
import { DatabaseExecutor } from "@/db/executor";
import { pageShares } from "@/db/schema";
import { type PageId, toPageId } from "@/modules/pages";
import type { PageShareEntity } from "../page-share.entity";
import {
	PageSharesRepository,
	type SharedPageOwner,
	ShareTokens,
} from "../page-shares.repository";

@Injectable()
export class PostgresPageSharesRepository extends PageSharesRepository {
	constructor(
		private readonly database: Database,
		private readonly owners: OwnerContext,
	) {
		super();
	}

	private get executor() {
		return DatabaseExecutor.for(this.database.db);
	}

	private get owner(): OwnerId {
		return this.owners.current();
	}

	async shareOf(id: PageId): Promise<PageShareEntity | undefined> {
		const [row] = await this.executor
			.select()
			.from(pageShares)
			.where(
				and(
					eq(pageShares.ownerId, String(this.owner)),
					eq(pageShares.pageId, String(id)),
				),
			)
			.limit(1);

		return row === undefined
			? undefined
			: {
					pageId: toPageId(row.pageId),
					token: row.token,
					createdAt: row.createdAt,
				};
	}

	async save(share: PageShareEntity): Promise<void> {
		await this.executor
			.insert(pageShares)
			.values({
				ownerId: String(this.owner),
				pageId: String(share.pageId),
				token: share.token,
				createdAt: share.createdAt,
			})
			.onConflictDoUpdate({
				target: pageShares.pageId,
				set: { token: share.token, createdAt: share.createdAt },
			});
	}

	async delete(id: PageId): Promise<void> {
		await this.executor
			.delete(pageShares)
			.where(
				and(
					eq(pageShares.ownerId, String(this.owner)),
					eq(pageShares.pageId, String(id)),
				),
			);
	}
}

@Injectable()
export class PostgresShareTokens extends ShareTokens {
	constructor(private readonly database: Database) {
		super();
	}

	async ownerFor(token: string): Promise<SharedPageOwner | undefined> {
		if (token.length === 0) {
			return undefined;
		}

		const [row] = await this.database.db
			.select({ ownerId: pageShares.ownerId, pageId: pageShares.pageId })
			.from(pageShares)
			.where(eq(pageShares.token, token))
			.limit(1);

		return row === undefined
			? undefined
			: { owner: toOwnerId(row.ownerId), pageId: toPageId(row.pageId) };
	}
}
