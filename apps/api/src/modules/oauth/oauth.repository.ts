import type {
	OAuthAuthorizationCode,
	OAuthClient,
	OAuthToken,
	TokenKind,
} from "./oauth.entity";

export abstract class OAuthRepository {
	abstract saveClient(client: OAuthClient): Promise<void>;
	abstract findClient(clientId: string): Promise<OAuthClient | undefined>;
	abstract saveCode(code: string, data: OAuthAuthorizationCode): Promise<void>;
	abstract findCode(code: string): Promise<OAuthAuthorizationCode | undefined>;
	abstract consumeCode(
		code: string,
	): Promise<OAuthAuthorizationCode | undefined>;
	abstract saveToken(
		token: string,
		kind: TokenKind,
		data: OAuthToken,
	): Promise<void>;
	abstract findToken(
		token: string,
		kind: TokenKind,
	): Promise<OAuthToken | undefined>;
	abstract revokeToken(token: string): Promise<void>;
}
