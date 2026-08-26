import {
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";

const createdAt = () =>
	timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
	timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull().default(false),
	image: text("image"),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		token: text("token").notNull().unique(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [index("session_user_idx").on(table.userId)],
);

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			withTimezone: true,
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		unique("account_provider_account_unique").on(
			table.providerId,
			table.accountId,
		),
		index("account_user_idx").on(table.userId),
	],
);

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const authEvents = pgTable(
	"auth_events",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		kind: text("kind").notNull(),
		subject: text("subject"),
		detail: text("detail"),
		createdAt: createdAt(),
	},
	(table) => [
		index("auth_events_user_idx").on(table.userId),
		index("auth_events_kind_idx").on(table.kind),
	],
);

export const apiTokens = pgTable(
	"api_tokens",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		tokenHash: text("token_hash").notNull().unique(),
		scopes: text("scopes").array().notNull(),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: createdAt(),
	},
	(table) => [index("api_tokens_owner_idx").on(table.ownerId)],
);

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
		// Null only between registration and consent: a code is bound to whoever
		// approved it, and an unbound code can never be exchanged.
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
