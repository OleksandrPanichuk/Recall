import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { type OwnerId, toOwnerId } from "@/core/owner";
import { DatabaseConnection } from "@/db/connection";
import { DatabaseExecutor } from "@/db/executor";
import { account, authEvents } from "@/db/schema";
import {
	AuthRepository,
	type LinkAccountData,
	type RecordAuthEventData,
} from "../auth.repository";

@Injectable()
export class PostgresAuthRepository extends AuthRepository {
	constructor(private readonly connection: DatabaseConnection) {
		super();
	}

	private get executor() {
		return DatabaseExecutor.for(this.connection.db);
	}

	async findOwnerByAccount(
		providerId: string,
		accountId: string,
	): Promise<OwnerId | undefined> {
		const [row] = await this.executor
			.select({ userId: account.userId })
			.from(account)
			.where(
				and(
					eq(account.providerId, providerId),
					eq(account.accountId, accountId),
				),
			)
			.limit(1);

		return row === undefined ? undefined : toOwnerId(row.userId);
	}

	async linkAccount(data: LinkAccountData): Promise<void> {
		await this.executor.insert(account).values({
			id: data.id,
			accountId: data.accountId,
			providerId: data.providerId,
			userId: data.ownerId,
			createdAt: data.at,
			updatedAt: data.at,
		});
	}

	async recordEvent(data: RecordAuthEventData): Promise<void> {
		await this.executor.insert(authEvents).values({
			id: data.id,
			userId: data.ownerId ?? null,
			kind: data.kind,
			subject: data.subject,
		});
	}
}
