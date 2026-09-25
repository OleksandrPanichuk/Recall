import type { ApiTokenEntity } from "./api-token.entity";

export interface CreateApiTokenData {
	readonly id: string;
	readonly name: string;
	readonly tokenHash: string;
	readonly scopes: readonly string[];
	readonly expiresAt?: Date;
}

export abstract class ApiTokensRepository {
	abstract insert(data: CreateApiTokenData): Promise<void>;
	abstract listLive(): Promise<readonly ApiTokenEntity[]>;
	abstract revoke(tokenId: string, at: Date): Promise<boolean>;
}

export abstract class ApiTokenCredentials {
	abstract findLiveByHash(
		tokenHash: string,
		at: Date,
	): Promise<ApiTokenEntity | undefined>;
	abstract touch(tokenId: string, at: Date): Promise<void>;
}
