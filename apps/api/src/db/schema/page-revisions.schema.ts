import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt } from "./columns";
import { pages } from "./pages.schema";

export const pageRevisions = pgTable(
	"page_revisions",
	{
		id: uuid("id").primaryKey(),
		pageId: uuid("page_id")
			.notNull()
			.references(() => pages.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		contentMd: text("content_md"),
		authorKind: text("author_kind").notNull().default("user"),
		createdAt: createdAt(),
	},
	(table) => [
		index("page_revisions_page_idx").on(table.pageId, table.createdAt),
		check(
			"page_revisions_author_check",
			sql`${table.authorKind} in ('user', 'mcp')`,
		),
	],
);
