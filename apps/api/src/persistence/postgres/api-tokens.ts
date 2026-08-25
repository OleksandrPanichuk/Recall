import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { type OwnerId, toOwnerId } from "@/application/ports/owner";
import { apiTokens } from "./auth-schema";
import type { RecallDatabase } from "./client";

export const TOKEN_PREFIX = "recall_pat_";
export const DEFAULT_SCOPES = ["mcp"] as const;

export interface IssuedApiToken {
	readonly id: string;
	readonly token: string;
	readonly name: string;
	readonly expiresAt?: Date;
}

export interface ApiTokenSummary {
	readonly id: string;
	readonly name: string;
	readonly scopes: readonly string[];
	readonly lastUsedAt?: Date;
	readonly expiresAt?: Date;
	readonly createdAt: Date;
}

export interface ApiTokenPrincipal {
	readonly tokenId: string;
	readonly owner: OwnerId;
	readonly scopes: readonly string[];
	readonly expiresAt?: Date;
}

// Only the hash is stored: a leaked database does not hand anyone a working
// credential, and the token itself is shown once at issue time.
const hashOf = (token: string): string =>
	createHash("sha256").update(token, "utf8").digest("hex");

export const looksLikeApiToken = (token: string): boolean =>
	token.startsWith(TOKEN_PREFIX);

export async function issueApiToken(
	db: RecallDatabase,
	options: {
		readonly owner: OwnerId;
		readonly name: string;
		readonly scopes?: readonly string[];
		readonly expiresAt?: Date;
	},
): Promise<IssuedApiToken> {
	const id = randomUUID();
	const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;

	await db.insert(apiTokens).values({
		id,
		ownerId: options.owner,
		name: options.name,
		tokenHash: hashOf(token),
		scopes: [...(options.scopes ?? DEFAULT_SCOPES)],
		expiresAt: options.expiresAt ?? null,
	});

	return { id, token, name: options.name, expiresAt: options.expiresAt };
}

export async function findApiTokenPrincipal(
	db: RecallDatabase,
	token: string,
	at: Date,
): Promise<ApiTokenPrincipal | undefined> {
	const [row] = await db
		.select()
		.from(apiTokens)
		.where(
			and(
				eq(apiTokens.tokenHash, hashOf(token)),
				isNull(apiTokens.revokedAt),
				or(
					isNull(apiTokens.expiresAt),
					// An ISO string with an explicit cast: postgres.js picks its
					// encoders from the first execution of a query string, and a raw
					// Date makes it choose one that then fails.
					sql`${apiTokens.expiresAt} > ${at.toISOString()}::timestamptz`,
				),
			),
		)
		.limit(1);

	if (row === undefined) {
		return undefined;
	}

	return {
		tokenId: row.id,
		owner: toOwnerId(row.ownerId),
		scopes: row.scopes,
		expiresAt: row.expiresAt ?? undefined,
	};
}

export async function touchApiToken(
	db: RecallDatabase,
	tokenId: string,
	at: Date,
): Promise<void> {
	await db
		.update(apiTokens)
		.set({ lastUsedAt: at })
		.where(eq(apiTokens.id, tokenId));
}

export async function listApiTokens(
	db: RecallDatabase,
	owner: OwnerId,
): Promise<readonly ApiTokenSummary[]> {
	const rows = await db
		.select()
		.from(apiTokens)
		.where(and(eq(apiTokens.ownerId, owner), isNull(apiTokens.revokedAt)))
		.orderBy(desc(apiTokens.createdAt));

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		scopes: row.scopes,
		lastUsedAt: row.lastUsedAt ?? undefined,
		expiresAt: row.expiresAt ?? undefined,
		createdAt: row.createdAt,
	}));
}

export async function revokeApiToken(
	db: RecallDatabase,
	owner: OwnerId,
	tokenId: string,
	at: Date,
): Promise<boolean> {
	const revoked = await db
		.update(apiTokens)
		.set({ revokedAt: at })
		.where(
			and(
				eq(apiTokens.id, tokenId),
				eq(apiTokens.ownerId, owner),
				isNull(apiTokens.revokedAt),
			),
		)
		.returning({ id: apiTokens.id });

	return revoked.length > 0;
}
