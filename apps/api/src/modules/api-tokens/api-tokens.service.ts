import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { OwnerId } from "@/core/owner";
import { Clock } from "@/core/ports/clock";
import { AuthService } from "@/modules/auth";
import {
	ApiTokenEntity,
	type ApiTokenPrincipal,
	type ApiTokenSummary,
	type IssuedApiToken,
} from "./api-token.entity";
import { ApiTokensRepository } from "./api-tokens.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ApiTokensService {
	constructor(
		private readonly repository: ApiTokensRepository,
		private readonly auth: AuthService,
		private readonly clock: Clock,
	) {}

	async issue(
		owner: OwnerId,
		options: { readonly name: string; readonly expiresInDays?: number },
	): Promise<IssuedApiToken> {
		const id = randomUUID();
		const token = ApiTokenEntity.mint();
		const expiresAt =
			options.expiresInDays === undefined
				? undefined
				: new Date(this.clock.now().getTime() + options.expiresInDays * DAY_MS);

		await this.repository.insert({
			id,
			ownerId: owner,
			name: options.name,
			tokenHash: ApiTokenEntity.hashOf(token),
			scopes: ApiTokenEntity.DEFAULT_SCOPES,
			expiresAt,
		});
		await this.auth.recordEvent("api-token-issued", id, owner);

		return { id, token, name: options.name, expiresAt };
	}

	async list(owner: OwnerId): Promise<readonly ApiTokenSummary[]> {
		return (await this.repository.listLiveFor(owner)).map(
			ApiTokenEntity.toSummary,
		);
	}

	async revoke(owner: OwnerId, tokenId: string): Promise<boolean> {
		const revoked = await this.repository.revoke(
			owner,
			tokenId,
			this.clock.now(),
		);

		if (revoked) {
			await this.auth.recordEvent("api-token-revoked", tokenId, owner);
		}

		return revoked;
	}

	async principalFor(token: string): Promise<ApiTokenPrincipal | undefined> {
		if (!ApiTokenEntity.looksLikeToken(token)) {
			return undefined;
		}

		const at = this.clock.now();
		const entity = await this.repository.findLiveByHash(
			ApiTokenEntity.hashOf(token),
			at,
		);

		if (entity === undefined) {
			return undefined;
		}

		await this.repository.touch(entity.id, at);

		return ApiTokenEntity.toPrincipal(entity);
	}

	ownerForTelegram(telegramUserId: number): Promise<OwnerId> {
		return this.auth.requireOwnerForTelegram(telegramUserId);
	}
}
