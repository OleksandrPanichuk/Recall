import { randomBytes } from "node:crypto";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import {
	InvalidGrantError,
	InvalidTokenError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type {
	OAuthClientInformationFull,
	OAuthTokenRevocationRequest,
	OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { Response } from "express";
import {
	type OAuthStore,
	type StoredAuthorizationCode,
	TokenKind,
} from "@/infrastructure/auth/oauth-store.types";

export const CONSENT_PATH = "/consent";
export const STATIC_CLIENT_ID = "static-token";
export const OFFLINE_ACCESS = "offline_access";

const CODE_TTL_MS = 60_000;
const ACCESS_TTL_MS = 60 * 60 * 1000;
const PENDING_TTL_MS = 10 * 60 * 1000;

export interface PendingAuthorization {
	readonly clientId: string;
	readonly clientName?: string;
	readonly redirectUri: string;
	readonly codeChallenge: string;
	readonly scopes: readonly string[];
	readonly state?: string;
	readonly resource?: string;
	readonly expiresAt: number;
}

export interface ConsentGate {
	pending(id: string): PendingAuthorization | undefined;
	approve(id: string): string | undefined;
}

export interface RecallOAuth {
	readonly provider: OAuthServerProvider;
	readonly consent: ConsentGate;
}

export interface OAuthProviderDependencies {
	readonly store: OAuthStore;
	readonly staticToken?: string;
	now(): Date;
}

const secret = (): string => randomBytes(32).toString("base64url");

export function createOAuthProvider(
	dependencies: OAuthProviderDependencies,
): RecallOAuth {
	const { store, staticToken, now } = dependencies;
	const pendings = new Map<string, PendingAuthorization>();

	const forget = (): void => {
		for (const [id, pending] of pendings) {
			if (pending.expiresAt <= now().getTime()) {
				pendings.delete(id);
			}
		}
	};

	const issue = (clientId: string, scopes: readonly string[]): OAuthTokens => {
		const accessToken = secret();
		const refreshToken = secret();

		store.saveToken(accessToken, TokenKind.Access, {
			clientId,
			scopes,
			expiresAt: new Date(now().getTime() + ACCESS_TTL_MS),
		});
		store.saveToken(refreshToken, TokenKind.Refresh, { clientId, scopes });

		return {
			access_token: accessToken,
			token_type: "Bearer",
			expires_in: Math.floor(ACCESS_TTL_MS / 1000),
			refresh_token: refreshToken,
			scope: scopes.join(" "),
		};
	};

	const codeOf = (
		code: string,
		client: OAuthClientInformationFull,
	): StoredAuthorizationCode => {
		const stored = store.findCode(code);

		if (stored === undefined || stored.clientId !== client.client_id) {
			throw new InvalidGrantError("Unknown or expired authorization code");
		}

		return stored;
	};

	const clientsStore: OAuthRegisteredClientsStore = {
		getClient: (clientId) => {
			const stored = store.findClient(clientId);

			return stored === undefined
				? undefined
				: (JSON.parse(stored.document) as OAuthClientInformationFull);
		},

		registerClient: (client) => {
			const registered = {
				...client,
				client_id: secret(),
				client_id_issued_at: Math.floor(now().getTime() / 1000),
			} as OAuthClientInformationFull;

			store.saveClient({
				clientId: registered.client_id,
				document: JSON.stringify(registered),
			});

			return registered;
		},
	};

	const provider: OAuthServerProvider = {
		get clientsStore() {
			return clientsStore;
		},

		authorize: async (client, params, res: Response) => {
			forget();

			const id = secret();

			pendings.set(id, {
				clientId: client.client_id,
				clientName: client.client_name,
				redirectUri: params.redirectUri,
				codeChallenge: params.codeChallenge,
				scopes: params.scopes ?? [],
				state: params.state,
				resource: params.resource?.href,
				expiresAt: now().getTime() + PENDING_TTL_MS,
			});

			res.redirect(`${CONSENT_PATH}?pending=${encodeURIComponent(id)}`);
		},

		challengeForAuthorizationCode: async (client, authorizationCode) =>
			codeOf(authorizationCode, client).codeChallenge,

		exchangeAuthorizationCode: async (
			client,
			authorizationCode,
			_codeVerifier,
			redirectUri,
		) => {
			const stored = codeOf(authorizationCode, client);

			if (redirectUri !== undefined && redirectUri !== stored.redirectUri) {
				throw new InvalidGrantError(
					"Redirect uri does not match the authorization",
				);
			}

			const consumed = store.consumeCode(authorizationCode);

			if (consumed === undefined) {
				throw new InvalidGrantError("Authorization code was already used");
			}

			return issue(client.client_id, consumed.scopes);
		},

		exchangeRefreshToken: async (client, refreshToken, scopes) => {
			const stored = store.findToken(refreshToken, TokenKind.Refresh);

			if (stored === undefined || stored.clientId !== client.client_id) {
				throw new InvalidGrantError("Unknown or expired refresh token");
			}

			store.revokeToken(refreshToken);

			return issue(client.client_id, scopes ?? stored.scopes);
		},

		verifyAccessToken: async (token): Promise<AuthInfo> => {
			if (staticToken !== undefined && token === staticToken) {
				return {
					token,
					clientId: STATIC_CLIENT_ID,
					scopes: [OFFLINE_ACCESS],
					expiresAt: Math.floor((now().getTime() + ACCESS_TTL_MS) / 1000),
				};
			}

			const stored = store.findToken(token, TokenKind.Access);

			if (stored === undefined) {
				throw new InvalidTokenError("Unknown or expired access token");
			}

			return {
				token,
				clientId: stored.clientId,
				scopes: [...stored.scopes],
				expiresAt:
					stored.expiresAt === undefined
						? undefined
						: Math.floor(stored.expiresAt.getTime() / 1000),
			};
		},

		revokeToken: async (
			_client: OAuthClientInformationFull,
			request: OAuthTokenRevocationRequest,
		) => {
			store.revokeToken(request.token);
		},
	};

	const consent: ConsentGate = {
		pending: (id) => {
			forget();

			return pendings.get(id);
		},

		approve: (id) => {
			forget();

			const pending = pendings.get(id);

			if (pending === undefined) {
				return undefined;
			}

			pendings.delete(id);

			const code = secret();

			store.saveCode(code, {
				clientId: pending.clientId,
				codeChallenge: pending.codeChallenge,
				redirectUri: pending.redirectUri,
				resource: pending.resource,
				scopes: pending.scopes,
				expiresAt: new Date(now().getTime() + CODE_TTL_MS),
			});

			const target = new URL(pending.redirectUri);

			target.searchParams.set("code", code);

			if (pending.state !== undefined) {
				target.searchParams.set("state", pending.state);
			}

			return target.href;
		},
	};

	return { provider, consent };
}
