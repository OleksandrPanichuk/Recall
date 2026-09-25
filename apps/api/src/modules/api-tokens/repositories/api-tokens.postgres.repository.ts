import { Injectable } from "@nestjs/common";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { OwnerId } from "@/core/owner";
import { OwnerContext } from "@/core/owner-context";
import { Database } from "@/db/connection";
import { DatabaseExecutor } from "@/db/executor";
import { apiTokens } from "@/db/schema";
import type { ApiTokenEntity } from "../api-token.entity";
import {
	ApiTokenCredentials,
	ApiTokensRepository,
	type CreateApiTokenData,
} from "../api-tokens.repository";

@Injectable()
export class PostgresApiTokensRepository extends ApiTokensRepository {
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

	async insert(data: CreateApiTokenData): Promise<void> {
		await this.executor.insert(apiTokens).values({
			id: data.id,
			ownerId: this.owner,
			name: data.name,
			tokenHash: data.tokenHash,
			scopes: [...data.scopes],
			expiresAt: data.expiresAt ?? null,
		});
	}

	listLive(): Promise<readonly ApiTokenEntity[]> {
		return this.executor
			.select()
			.from(apiTokens)
			.where(
				and(eq(apiTokens.ownerId, this.owner), isNull(apiTokens.revokedAt)),
			)
			.orderBy(desc(apiTokens.createdAt));
	}

	async revoke(tokenId: string, at: Date): Promise<boolean> {
		const revoked = await this.executor
			.update(apiTokens)
			.set({ revokedAt: at })
			.where(
				and(
					eq(apiTokens.id, tokenId),
					eq(apiTokens.ownerId, this.owner),
					isNull(apiTokens.revokedAt),
				),
			)
			.returning({ id: apiTokens.id });

		return revoked.length > 0;
	}
}

@Injectable()
export class PostgresApiTokenCredentials extends ApiTokenCredentials {
	constructor(private readonly database: Database) {
		super();
	}

	private get executor() {
		return DatabaseExecutor.for(this.database.db);
	}

	async findLiveByHash(
		tokenHash: string,
		at: Date,
	): Promise<ApiTokenEntity | undefined> {
		const [row] = await this.executor
			.select()
			.from(apiTokens)
			.where(
				and(
					eq(apiTokens.tokenHash, tokenHash),
					isNull(apiTokens.revokedAt),
					or(
						isNull(apiTokens.expiresAt),
						sql`${apiTokens.expiresAt} > ${at.toISOString()}::timestamptz`,
					),
				),
			)
			.limit(1);

		return row;
	}

	async touch(tokenId: string, at: Date): Promise<void> {
		await this.executor
			.update(apiTokens)
			.set({ lastUsedAt: at })
			.where(eq(apiTokens.id, tokenId));
	}
}
