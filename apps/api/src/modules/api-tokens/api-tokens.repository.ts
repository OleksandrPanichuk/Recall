import type { OwnerId } from "@/core/owner";
import type { ApiTokenEntity } from "./api-token.entity";

export interface CreateApiTokenData {
	readonly id: string;
	readonly ownerId: OwnerId;
	readonly name: string;
	readonly tokenHash: string;
	readonly scopes: readonly string[];
	readonly expiresAt?: Date;
}

export abstract class ApiTokensRepository {
	abstract insert(data: CreateApiTokenData): Promise<void>;
	abstract findLiveByHash(
		tokenHash: string,
		at: Date,
	): Promise<ApiTokenEntity | undefined>;
	abstract listLiveFor(owner: OwnerId): Promise<readonly ApiTokenEntity[]>;
	abstract touch(tokenId: string, at: Date): Promise<void>;
	abstract revoke(owner: OwnerId, tokenId: string, at: Date): Promise<boolean>;
}
