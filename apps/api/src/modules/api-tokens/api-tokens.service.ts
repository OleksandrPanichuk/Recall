import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { OwnerId } from "@/core/owner";
import { Clock } from "@/core/ports/clock";
import { AuthService } from "@/modules/auth";
import { requireOwner } from "@/shared/request-context";
import {
	ApiTokenEntity,
	type ApiTokenPrincipal,
	type ApiTokenSummary,
	type IssuedApiToken,
} from "./api-token.entity";
import {
	ApiTokenCredentials,
	ApiTokensRepository,
} from "./api-tokens.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ApiTokensService {
	constructor(
		private readonly repository: ApiTokensRepository,
		private readonly credentials: ApiTokenCredentials,
		private readonly auth: AuthService,
		private readonly clock: Clock,
	) {}

	async issue(options: {
		readonly name: string;
		readonly expiresInDays?: number;
	}): Promise<IssuedApiToken> {
		const owner = requireOwner();
		const id = randomUUID();
		const token = ApiTokenEntity.mint();
		const expiresAt =
			options.expiresInDays === undefined
				? undefined
				: new Date(this.clock.now().getTime() + options.expiresInDays * DAY_MS);

		await this.repository.insert({
			id,
			name: options.name,
			tokenHash: ApiTokenEntity.hashOf(token),
			scopes: ApiTokenEntity.DEFAULT_SCOPES,
			expiresAt,
		});
		await this.auth.recordEvent("api-token-issued", id, owner);

		return { id, token, name: options.name, expiresAt };
	}

	async list(): Promise<readonly ApiTokenSummary[]> {
		return (await this.repository.listLive()).map(ApiTokenEntity.toSummary);
	}

	async revoke(tokenId: string): Promise<boolean> {
		const revoked = await this.repository.revoke(tokenId, this.clock.now());

		if (revoked) {
			await this.auth.recordEvent("api-token-revoked", tokenId, requireOwner());
		}

		return revoked;
	}

	async principalFor(token: string): Promise<ApiTokenPrincipal | undefined> {
		if (!ApiTokenEntity.looksLikeToken(token)) {
			return undefined;
		}

		const at = this.clock.now();
		const entity = await this.credentials.findLiveByHash(
			ApiTokenEntity.hashOf(token),
			at,
		);

		if (entity === undefined) {
			return undefined;
		}

		await this.credentials.touch(entity.id, at);

		return ApiTokenEntity.toPrincipal(entity);
	}

	ownerForTelegram(telegramUserId: number): Promise<OwnerId> {
		return this.auth.requireOwnerForTelegram(telegramUserId);
	}
}
