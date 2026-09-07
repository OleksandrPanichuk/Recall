import { Injectable } from "@nestjs/common";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { OwnerId } from "@/core/owner";
import { DatabaseConnection } from "@/db/connection";
import { DatabaseExecutor } from "@/db/executor";
import { apiTokens } from "@/db/schema";
import type { ApiTokenEntity } from "../api-token.entity";
import {
	ApiTokensRepository,
	type CreateApiTokenData,
} from "../api-tokens.repository";

@Injectable()
export class PostgresApiTokensRepository extends ApiTokensRepository {
	constructor(private readonly connection: DatabaseConnection) {
		super();
	}

	private get executor() {
		return DatabaseExecutor.for(this.connection.db);
	}

	async insert(data: CreateApiTokenData): Promise<void> {
		await this.executor.insert(apiTokens).values({
			id: data.id,
			ownerId: data.ownerId,
			name: data.name,
			tokenHash: data.tokenHash,
			scopes: [...data.scopes],
			expiresAt: data.expiresAt ?? null,
		});
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

	listLiveFor(owner: OwnerId): Promise<readonly ApiTokenEntity[]> {
		return this.executor
			.select()
			.from(apiTokens)
			.where(and(eq(apiTokens.ownerId, owner), isNull(apiTokens.revokedAt)))
			.orderBy(desc(apiTokens.createdAt));
	}

	async touch(tokenId: string, at: Date): Promise<void> {
		await this.executor
			.update(apiTokens)
			.set({ lastUsedAt: at })
			.where(eq(apiTokens.id, tokenId));
	}

	async revoke(owner: OwnerId, tokenId: string, at: Date): Promise<boolean> {
		const revoked = await this.executor
			.update(apiTokens)
			.set({ revokedAt: at })
			.where(
				and(
					eq(apiTokens.id, tokenId),
					eq(apiTokens.ownerId, owner),
					isNull(apiTokens.revokedAt),
				),
			)
			.returning({ id: apiTokens.id });

		return revoked.length > 0;
	}
}
