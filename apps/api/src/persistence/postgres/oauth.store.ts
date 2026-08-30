import { createHash } from "node:crypto";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import type {
	OAuthStore,
	StoredAuthorizationCode,
	StoredClient,
	StoredToken,
	TokenKind,
} from "@/infrastructure/auth/oauth-store.types";
import { oauthClients, oauthCodes, oauthTokens } from "./auth-schema";
import type { RecallDatabase } from "./client";

const hashOf = (value: string): string =>
	createHash("sha256").update(value, "utf8").digest("hex");

export function createPostgresOAuthStore(
	db: RecallDatabase,
	now: () => Date,
): OAuthStore {
	const at = (): string => now().toISOString();

	return {
		async saveClient(client: StoredClient): Promise<void> {
			await db
				.insert(oauthClients)
				.values({ clientId: client.clientId, document: client.document })
				.onConflictDoUpdate({
					target: oauthClients.clientId,
					set: { document: client.document },
				});
		},

		async findClient(clientId: string): Promise<StoredClient | undefined> {
			const [row] = await db
				.select()
				.from(oauthClients)
				.where(eq(oauthClients.clientId, clientId))
				.limit(1);

			return row === undefined
				? undefined
				: { clientId: row.clientId, document: row.document };
		},

		async saveCode(code: string, data: StoredAuthorizationCode): Promise<void> {
			await db.insert(oauthCodes).values({
				codeHash: hashOf(code),
				clientId: data.clientId,
				ownerId: data.ownerId ?? null,
				codeChallenge: data.codeChallenge,
				redirectUri: data.redirectUri,
				resource: data.resource ?? null,
				scopes: [...data.scopes],
				expiresAt: data.expiresAt,
			});
		},

		async findCode(code: string): Promise<StoredAuthorizationCode | undefined> {
			const [row] = await db
				.select()
				.from(oauthCodes)
				.where(
					and(
						eq(oauthCodes.codeHash, hashOf(code)),
						isNull(oauthCodes.consumedAt),
						sql`${oauthCodes.expiresAt} > ${at()}::timestamptz`,
					),
				)
				.limit(1);

			return row === undefined ? undefined : toCode(row);
		},

		async consumeCode(
			code: string,
		): Promise<StoredAuthorizationCode | undefined> {
			const [row] = await db
				.update(oauthCodes)
				.set({ consumedAt: now() })
				.where(
					and(
						eq(oauthCodes.codeHash, hashOf(code)),
						isNull(oauthCodes.consumedAt),
						sql`${oauthCodes.expiresAt} > ${at()}::timestamptz`,
					),
				)
				.returning();

			return row === undefined ? undefined : toCode(row);
		},

		async saveToken(
			token: string,
			kind: TokenKind,
			data: StoredToken,
		): Promise<void> {
			await db.insert(oauthTokens).values({
				tokenHash: hashOf(token),
				kind,
				clientId: data.clientId,
				ownerId: data.ownerId ?? null,
				scopes: [...data.scopes],
				expiresAt: data.expiresAt ?? null,
			});
		},

		async findToken(
			token: string,
			kind: TokenKind,
		): Promise<StoredToken | undefined> {
			const [row] = await db
				.select()
				.from(oauthTokens)
				.where(
					and(
						eq(oauthTokens.tokenHash, hashOf(token)),
						eq(oauthTokens.kind, kind),
						isNull(oauthTokens.revokedAt),
						or(
							isNull(oauthTokens.expiresAt),
							sql`${oauthTokens.expiresAt} > ${at()}::timestamptz`,
						),
					),
				)
				.limit(1);

			return row === undefined
				? undefined
				: {
						clientId: row.clientId,
						scopes: row.scopes,
						expiresAt: row.expiresAt ?? undefined,
						ownerId: row.ownerId ?? undefined,
					};
		},

		async revokeToken(token: string): Promise<void> {
			await db
				.update(oauthTokens)
				.set({ revokedAt: now() })
				.where(eq(oauthTokens.tokenHash, hashOf(token)));
		},
	};
}

type CodeRow = typeof oauthCodes.$inferSelect;

const toCode = (row: CodeRow): StoredAuthorizationCode => ({
	clientId: row.clientId,
	codeChallenge: row.codeChallenge,
	redirectUri: row.redirectUri,
	resource: row.resource ?? undefined,
	scopes: row.scopes,
	expiresAt: row.expiresAt,
	ownerId: row.ownerId ?? undefined,
});
