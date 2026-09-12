import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.schema";
import { createdAt } from "./columns";

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
