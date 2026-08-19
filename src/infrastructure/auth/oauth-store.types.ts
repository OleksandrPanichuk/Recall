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
}

export interface StoredToken {
	readonly clientId: string;
	readonly scopes: readonly string[];
	readonly expiresAt?: Date;
}

export interface OAuthStore {
	saveClient(client: StoredClient): void;
	findClient(clientId: string): StoredClient | undefined;
	saveCode(code: string, data: StoredAuthorizationCode): void;
	findCode(code: string): StoredAuthorizationCode | undefined;
	consumeCode(code: string): StoredAuthorizationCode | undefined;
	saveToken(token: string, kind: TokenKind, data: StoredToken): void;
	findToken(token: string, kind: TokenKind): StoredToken | undefined;
	revokeToken(token: string): void;
}
