import { randomUUID } from "node:crypto";
import {
	Inject,
	Injectable,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { OwnerId } from "@/application/ports/owner";
import {
	type ApiTokenSummary,
	type IssuedApiToken,
	issueApiToken,
	listApiTokens,
	revokeApiToken,
} from "@/persistence/postgres/api-tokens";
import { authEvents } from "@/persistence/postgres/auth-schema";
import type { PostgresConnection } from "@/persistence/postgres/client";
import { findTelegramOwner } from "@/persistence/postgres/owner";
import { CONNECTION } from "../shared/database/tokens";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ApiTokenService {
	constructor(
		@Inject(CONNECTION) private readonly connection: PostgresConnection,
	) {}

	async issue(
		telegramUserId: number,
		options: { readonly name: string; readonly expiresInDays?: number },
	): Promise<IssuedApiToken> {
		const owner = await this.ownerFor(telegramUserId);
		const issued = await issueApiToken(this.connection.db, {
			owner,
			name: options.name,
			expiresAt:
				options.expiresInDays === undefined
					? undefined
					: new Date(Date.now() + options.expiresInDays * DAY_MS),
		});

		await this.record("api-token-issued", owner, issued.id);

		return issued;
	}

	async list(telegramUserId: number): Promise<readonly ApiTokenSummary[]> {
		return listApiTokens(
			this.connection.db,
			await this.ownerFor(telegramUserId),
		);
	}

	async revoke(telegramUserId: number, tokenId: string): Promise<boolean> {
		const owner = await this.ownerFor(telegramUserId);
		const revoked = await revokeApiToken(
			this.connection.db,
			owner,
			tokenId,
			new Date(),
		);

		if (revoked) {
			await this.record("api-token-revoked", owner, tokenId);
		}

		return revoked;
	}

	private async ownerFor(telegramUserId: number): Promise<OwnerId> {
		const owner = await findTelegramOwner(this.connection.db, telegramUserId);

		if (owner === undefined) {
			throw new ServiceUnavailableException(
				"this telegram account has not linked the platform yet — send /login to the bot first",
			);
		}

		return owner;
	}

	private async record(
		kind: string,
		owner: OwnerId,
		subject: string,
	): Promise<void> {
		await this.connection.db.insert(authEvents).values({
			id: randomUUID(),
			userId: owner,
			kind,
			subject,
		});
	}
}
