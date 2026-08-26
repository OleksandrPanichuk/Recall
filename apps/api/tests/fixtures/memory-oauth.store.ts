import type {
	OAuthStore,
	StoredAuthorizationCode,
	StoredClient,
	StoredToken,
	TokenKind,
} from "@/infrastructure/auth/oauth-store.types";

interface Held {
	readonly kind: TokenKind;
	readonly token: StoredToken;
	revoked: boolean;
}

// The store's contract is what matters here, not where it lives. The postgres
// implementation is held to the same suite.
export function createMemoryOAuthStore(now: () => Date): OAuthStore {
	const clients = new Map<string, StoredClient>();
	const codes = new Map<
		string,
		{ data: StoredAuthorizationCode; used: boolean }
	>();
	const tokens = new Map<string, Held>();

	const live = (code: { data: StoredAuthorizationCode; used: boolean }) =>
		!code.used && code.data.expiresAt.getTime() > now().getTime();

	return {
		saveClient: async (client) => {
			clients.set(client.clientId, client);
		},
		findClient: async (clientId) => clients.get(clientId),
		saveCode: async (code, data) => {
			codes.set(code, { data, used: false });
		},
		findCode: async (code) => {
			const held = codes.get(code);

			return held !== undefined && live(held) ? held.data : undefined;
		},
		consumeCode: async (code) => {
			const held = codes.get(code);

			if (held === undefined || !live(held)) {
				return undefined;
			}

			held.used = true;

			return held.data;
		},
		saveToken: async (token, kind, data) => {
			tokens.set(token, { kind, token: data, revoked: false });
		},
		findToken: async (token, kind) => {
			const held = tokens.get(token);

			if (held === undefined || held.revoked || held.kind !== kind) {
				return undefined;
			}

			const expiresAt = held.token.expiresAt;

			if (expiresAt !== undefined && expiresAt.getTime() <= now().getTime()) {
				return undefined;
			}

			return held.token;
		},
		revokeToken: async (token) => {
			const held = tokens.get(token);

			if (held !== undefined) {
				held.revoked = true;
			}
		},
	};
}
