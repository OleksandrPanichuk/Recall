import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Transaction } from "@/application/ports/transaction";
import type {
	OAuthStore,
	StoredAuthorizationCode,
	StoredClient,
	StoredToken,
	TokenKind,
} from "@/infrastructure/auth/oauth-store.types";
import type { QuizDatabase } from "../database";
import { oauthClients, oauthCodes, oauthTokens } from "../schema";

const hashOf = (value: string): string =>
	createHash("sha256").update(value, "utf8").digest("hex");

const parseScopes = (raw: string): readonly string[] => {
	const parsed: unknown = JSON.parse(raw);

	return Array.isArray(parsed) ? (parsed as string[]) : [];
};

export function createSqliteOAuthStore(
	database: QuizDatabase,
	transaction: Transaction,
	now: () => Date,
): OAuthStore {
	const codeRow = (code: string) =>
		database
			.select()
			.from(oauthCodes)
			.where(
				and(
					eq(oauthCodes.codeHash, hashOf(code)),
					isNull(oauthCodes.consumedAt),
				),
			)
			.get();

	const unexpired = (row: { expiresAt: string }): boolean =>
		new Date(row.expiresAt).getTime() > now().getTime();

	const toCode = (row: {
		clientId: string;
		codeChallenge: string;
		redirectUri: string;
		resource: string | null;
		scopes: string;
		expiresAt: string;
	}): StoredAuthorizationCode => ({
		clientId: row.clientId,
		codeChallenge: row.codeChallenge,
		redirectUri: row.redirectUri,
		resource: row.resource ?? undefined,
		scopes: parseScopes(row.scopes),
		expiresAt: new Date(row.expiresAt),
	});

	return {
		saveClient(client: StoredClient): void {
			const row = {
				clientId: client.clientId,
				document: client.document,
				createdAt: now().toISOString(),
			};

			transaction.run(() => {
				database
					.insert(oauthClients)
					.values(row)
					.onConflictDoUpdate({
						target: oauthClients.clientId,
						set: { document: row.document },
					})
					.run();
			});
		},

		findClient(clientId: string): StoredClient | undefined {
			const row = database
				.select()
				.from(oauthClients)
				.where(eq(oauthClients.clientId, clientId))
				.get();

			return row === undefined
				? undefined
				: { clientId: row.clientId, document: row.document };
		},

		saveCode(code: string, data: StoredAuthorizationCode): void {
			transaction.run(() => {
				database
					.insert(oauthCodes)
					.values({
						codeHash: hashOf(code),
						clientId: data.clientId,
						codeChallenge: data.codeChallenge,
						redirectUri: data.redirectUri,
						resource: data.resource ?? null,
						scopes: JSON.stringify([...data.scopes]),
						expiresAt: data.expiresAt.toISOString(),
						createdAt: now().toISOString(),
					})
					.run();
			});
		},

		findCode(code: string): StoredAuthorizationCode | undefined {
			const row = codeRow(code);

			return row !== undefined && unexpired(row) ? toCode(row) : undefined;
		},

		consumeCode(code: string): StoredAuthorizationCode | undefined {
			const row = codeRow(code);

			if (row === undefined || !unexpired(row)) {
				return undefined;
			}

			transaction.run(() => {
				database
					.update(oauthCodes)
					.set({ consumedAt: now().toISOString() })
					.where(eq(oauthCodes.codeHash, hashOf(code)))
					.run();
			});

			return toCode(row);
		},

		saveToken(token: string, kind: TokenKind, data: StoredToken): void {
			transaction.run(() => {
				database
					.insert(oauthTokens)
					.values({
						tokenHash: hashOf(token),
						kind,
						clientId: data.clientId,
						scopes: JSON.stringify([...data.scopes]),
						expiresAt: data.expiresAt?.toISOString() ?? null,
						createdAt: now().toISOString(),
					})
					.run();
			});
		},

		findToken(token: string, kind: TokenKind): StoredToken | undefined {
			const row = database
				.select()
				.from(oauthTokens)
				.where(
					and(
						eq(oauthTokens.tokenHash, hashOf(token)),
						eq(oauthTokens.kind, kind),
						isNull(oauthTokens.revokedAt),
					),
				)
				.get();

			if (row === undefined) {
				return undefined;
			}

			if (row.expiresAt !== null && !unexpired({ expiresAt: row.expiresAt })) {
				return undefined;
			}

			return {
				clientId: row.clientId,
				scopes: parseScopes(row.scopes),
				expiresAt: row.expiresAt === null ? undefined : new Date(row.expiresAt),
			};
		},

		revokeToken(token: string): void {
			transaction.run(() => {
				database
					.update(oauthTokens)
					.set({ revokedAt: now().toISOString() })
					.where(eq(oauthTokens.tokenHash, hashOf(token)))
					.run();
			});
		},
	};
}
