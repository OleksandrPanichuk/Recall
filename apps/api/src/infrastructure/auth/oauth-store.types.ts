export const TokenKind = {
	Access: "access",
	Refresh: "refresh",
} as const;
export type TokenKind = (typeof TokenKind)[keyof typeof TokenKind];

export interface StoredClient {
	readonly clientId: string;
	readonly document: string;
}

export interface StoredAuthorizationCode {
	readonly clientId: string;
	readonly codeChallenge: string;
	readonly redirectUri: string;
	readonly resource?: string;
	readonly scopes: readonly string[];
	readonly expiresAt: Date;
	readonly ownerId?: string;
}

export interface StoredToken {
	readonly clientId: string;
	readonly scopes: readonly string[];
	readonly expiresAt?: Date;
	readonly ownerId?: string;
}

// Async throughout: the store lives in Postgres now. It was synchronous while it
// was a local SQLite file, and that is what pinned this app to bun:sqlite.
export interface OAuthStore {
	saveClient(client: StoredClient): Promise<void>;
	findClient(clientId: string): Promise<StoredClient | undefined>;
	saveCode(code: string, data: StoredAuthorizationCode): Promise<void>;
	findCode(code: string): Promise<StoredAuthorizationCode | undefined>;
	consumeCode(code: string): Promise<StoredAuthorizationCode | undefined>;
	saveToken(token: string, kind: TokenKind, data: StoredToken): Promise<void>;
	findToken(token: string, kind: TokenKind): Promise<StoredToken | undefined>;
	revokeToken(token: string): Promise<void>;
}
