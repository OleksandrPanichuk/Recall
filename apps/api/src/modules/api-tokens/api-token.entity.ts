import { createHash, randomBytes } from "node:crypto";
import type { OwnerId } from "@/core/owner";
import type { apiTokens } from "@/db/schema";

export type ApiTokenRow = typeof apiTokens.$inferSelect;

export interface ApiTokenEntity extends ApiTokenRow {}

export interface ApiTokenSummary {
	readonly id: string;
	readonly name: string;
	readonly scopes: readonly string[];
	readonly lastUsedAt?: Date;
	readonly expiresAt?: Date;
	readonly createdAt: Date;
}

export interface IssuedApiToken {
	readonly id: string;
	readonly token: string;
	readonly name: string;
	readonly expiresAt?: Date;
}

export interface ApiTokenPrincipal {
	readonly tokenId: string;
	readonly owner: OwnerId;
	readonly scopes: readonly string[];
	readonly expiresAt?: Date;
}

export class ApiTokenEntity {
	private constructor() {}

	static readonly PREFIX = "recall_pat_";
	static readonly DEFAULT_SCOPES: readonly string[] = ["mcp"];

	static mint(): string {
		return `${ApiTokenEntity.PREFIX}${randomBytes(32).toString("base64url")}`;
	}

	static hashOf(token: string): string {
		return createHash("sha256").update(token, "utf8").digest("hex");
	}

	static looksLikeToken(token: string): boolean {
		return token.startsWith(ApiTokenEntity.PREFIX);
	}

	static toSummary(entity: ApiTokenEntity): ApiTokenSummary {
		return {
			id: entity.id,
			name: entity.name,
			scopes: entity.scopes,
			lastUsedAt: entity.lastUsedAt ?? undefined,
			expiresAt: entity.expiresAt ?? undefined,
			createdAt: entity.createdAt,
		};
	}

	static toPrincipal(entity: ApiTokenEntity): ApiTokenPrincipal {
		return {
			tokenId: entity.id,
			owner: entity.ownerId as OwnerId,
			scopes: entity.scopes,
			expiresAt: entity.expiresAt ?? undefined,
		};
	}
}
