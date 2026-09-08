import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { createdAt, deletedAt, updatedAt } from "./columns";
import { ownerId } from "./owner-id";
import { pages } from "./pages.schema";

export const quizzes = pgTable(
	"quizzes",
	{
		ownerId: ownerId(),
		id: uuid("id").primaryKey(),
		legacyId: text("legacy_id"),
		pageId: uuid("page_id").references(() => pages.id, {
			onDelete: "set null",
		}),
		title: text("title").notNull(),
		description: text("description"),
		language: text("language").notNull(),
		source: text("source"),
		sourceChapters: text("source_chapters"),
		tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
		status: text("status").notNull(),
		version: integer("version").notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		deletedAt: deletedAt(),
	},
	(table) => [
		index("quizzes_owner_idx").on(table.ownerId),
		unique("quizzes_legacy_unique").on(table.ownerId, table.legacyId),
		check(
			"quizzes_status_check",
			sql`${table.status} in ('draft', 'published', 'archived')`,
		),
		index("quizzes_status_idx").on(table.status, table.updatedAt),
		index("quizzes_page_idx").on(table.pageId),
	],
);
