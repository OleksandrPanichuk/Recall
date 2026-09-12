import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.schema";
import { createdAt } from "./columns";

export const oauthClients = pgTable("oauth_clients", {
	clientId: text("client_id").primaryKey(),
	document: text("document").notNull(),
	createdAt: createdAt(),
});

export const oauthCodes = pgTable(
	"oauth_codes",
	{
		codeHash: text("code_hash").primaryKey(),
		clientId: text("client_id").notNull(),
		ownerId: text("owner_id").references(() => user.id, {
			onDelete: "cascade",
		}),
		codeChallenge: text("code_challenge").notNull(),
		redirectUri: text("redirect_uri").notNull(),
		resource: text("resource"),
		scopes: text("scopes").array().notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		consumedAt: timestamp("consumed_at", { withTimezone: true }),
		createdAt: createdAt(),
	},
	(table) => [index("oauth_codes_client_idx").on(table.clientId)],
);

export const oauthTokens = pgTable(
	"oauth_tokens",
	{
		tokenHash: text("token_hash").primaryKey(),
		kind: text("kind").notNull(),
		clientId: text("client_id").notNull(),
		ownerId: text("owner_id").references(() => user.id, {
			onDelete: "cascade",
		}),
		scopes: text("scopes").array().notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: createdAt(),
	},
	(table) => [index("oauth_tokens_owner_idx").on(table.ownerId)],
);
