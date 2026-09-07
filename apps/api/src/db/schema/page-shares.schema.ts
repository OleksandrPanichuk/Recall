import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt } from "./columns";
import { ownerId } from "./owner-id";
import { pages } from "./pages.schema";

export const pageShares = pgTable(
	"page_shares",
	{
		ownerId: ownerId(),
		pageId: uuid("page_id")
			.primaryKey()
			.references(() => pages.id, { onDelete: "cascade" }),
		token: text("token").notNull(),
		createdAt: createdAt(),
	},
	(table) => [
		index("page_shares_owner_idx").on(table.ownerId),
		unique("page_shares_token_unique").on(table.token),
	],
);
