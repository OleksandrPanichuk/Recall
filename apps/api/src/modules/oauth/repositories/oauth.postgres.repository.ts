import { Injectable } from "@nestjs/common";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { Clock } from "@/core/ports/clock";
import { Database } from "@/db/connection";
import { DatabaseExecutor } from "@/db/executor";
import { oauthClients, oauthCodes, oauthTokens } from "@/db/schema";
import {
	type OAuthAuthorizationCode,
	type OAuthClient,
	OAuthSecret,
	type OAuthToken,
	type TokenKind,
} from "../oauth.entity";
import { OAuthRepository } from "../oauth.repository";

type CodeRow = typeof oauthCodes.$inferSelect;

const toCode = (row: CodeRow): OAuthAuthorizationCode => ({
	clientId: row.clientId,
	codeChallenge: row.codeChallenge,
	redirectUri: row.redirectUri,
	resource: row.resource ?? undefined,
	scopes: row.scopes,
	expiresAt: row.expiresAt,
	ownerId: row.ownerId ?? undefined,
});

@Injectable()
export class PostgresOAuthRepository extends OAuthRepository {
	constructor(
		private readonly database: Database,
		private readonly clock: Clock,
	) {
		super();
	}

	private get executor() {
		return DatabaseExecutor.for(this.database.db);
	}

	private get at(): string {
		return this.clock.now().toISOString();
	}

	async saveClient(client: OAuthClient): Promise<void> {
		await this.executor
			.insert(oauthClients)
			.values({ clientId: client.clientId, document: client.document })
			.onConflictDoUpdate({
				target: oauthClients.clientId,
				set: { document: client.document },
			});
	}

	async findClient(clientId: string): Promise<OAuthClient | undefined> {
		const [row] = await this.executor
			.select()
			.from(oauthClients)
			.where(eq(oauthClients.clientId, clientId))
			.limit(1);

		return row === undefined
			? undefined
			: { clientId: row.clientId, document: row.document };
	}

	async saveCode(code: string, data: OAuthAuthorizationCode): Promise<void> {
		await this.executor.insert(oauthCodes).values({
			codeHash: OAuthSecret.hashOf(code),
			clientId: data.clientId,
			ownerId: data.ownerId ?? null,
			codeChallenge: data.codeChallenge,
			redirectUri: data.redirectUri,
			resource: data.resource ?? null,
			scopes: [...data.scopes],
			expiresAt: data.expiresAt,
		});
	}

	async findCode(code: string): Promise<OAuthAuthorizationCode | undefined> {
		const [row] = await this.executor
			.select()
			.from(oauthCodes)
			.where(
				and(
					eq(oauthCodes.codeHash, OAuthSecret.hashOf(code)),
					isNull(oauthCodes.consumedAt),
					sql`${oauthCodes.expiresAt} > ${this.at}::timestamptz`,
				),
			)
			.limit(1);

		return row === undefined ? undefined : toCode(row);
	}

	async consumeCode(code: string): Promise<OAuthAuthorizationCode | undefined> {
		const [row] = await this.executor
			.update(oauthCodes)
			.set({ consumedAt: this.clock.now() })
			.where(
				and(
					eq(oauthCodes.codeHash, OAuthSecret.hashOf(code)),
					isNull(oauthCodes.consumedAt),
					sql`${oauthCodes.expiresAt} > ${this.at}::timestamptz`,
				),
			)
			.returning();

		return row === undefined ? undefined : toCode(row);
	}

	async saveToken(
		token: string,
		kind: TokenKind,
		data: OAuthToken,
	): Promise<void> {
		await this.executor.insert(oauthTokens).values({
			tokenHash: OAuthSecret.hashOf(token),
			kind,
			clientId: data.clientId,
			ownerId: data.ownerId ?? null,
			scopes: [...data.scopes],
			expiresAt: data.expiresAt ?? null,
		});
	}

	async findToken(
		token: string,
		kind: TokenKind,
	): Promise<OAuthToken | undefined> {
		const [row] = await this.executor
			.select()
			.from(oauthTokens)
			.where(
				and(
					eq(oauthTokens.tokenHash, OAuthSecret.hashOf(token)),
					eq(oauthTokens.kind, kind),
					isNull(oauthTokens.revokedAt),
					or(
						isNull(oauthTokens.expiresAt),
						sql`${oauthTokens.expiresAt} > ${this.at}::timestamptz`,
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
	}

	async revokeToken(token: string): Promise<void> {
		await this.executor
			.update(oauthTokens)
			.set({ revokedAt: this.clock.now() })
			.where(eq(oauthTokens.tokenHash, OAuthSecret.hashOf(token)));
	}
}
