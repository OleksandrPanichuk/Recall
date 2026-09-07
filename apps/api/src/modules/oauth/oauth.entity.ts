import { createHash } from "node:crypto";

export const TokenKind = {
	Access: "access",
	Refresh: "refresh",
} as const;
export type TokenKind = (typeof TokenKind)[keyof typeof TokenKind];

export interface OAuthClient {
	readonly clientId: string;
	readonly document: string;
}

export interface OAuthAuthorizationCode {
	readonly clientId: string;
	readonly codeChallenge: string;
	readonly redirectUri: string;
	readonly resource?: string;
	readonly scopes: readonly string[];
	readonly expiresAt: Date;
	readonly ownerId?: string;
}

export interface OAuthToken {
	readonly clientId: string;
	readonly scopes: readonly string[];
	readonly expiresAt?: Date;
	readonly ownerId?: string;
}

export class OAuthSecret {
	private constructor() {}

	static hashOf(value: string): string {
		return createHash("sha256").update(value, "utf8").digest("hex");
	}
}
