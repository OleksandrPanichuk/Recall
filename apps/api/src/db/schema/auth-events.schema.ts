import { index, pgTable, text } from "drizzle-orm/pg-core";
import { user } from "./auth.schema";
import { createdAt } from "./columns";

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
