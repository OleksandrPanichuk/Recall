import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	index,
	integer,
	numeric,
	pgTable,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { createdAt, deletedAt, updatedAt } from "./columns";
import { ownerId } from "./owner-id";

export const pages = pgTable(
	"pages",
	{
		ownerId: ownerId(),
		id: uuid("id").primaryKey(),
		legacyId: text("legacy_id"),
		parentId: uuid("parent_id").references((): AnyPgColumn => pages.id, {
			onDelete: "restrict",
		}),
		title: text("title").notNull(),
		slug: text("slug").notNull(),
		icon: text("icon"),
		contentMd: text("content_md"),
		position: numeric("position", { precision: 20, scale: 10 })
			.notNull()
			.default("0"),
		version: integer("version").notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		deletedAt: deletedAt(),
	},
	(table) => [
		index("pages_owner_idx").on(table.ownerId),
		unique("pages_legacy_unique").on(table.ownerId, table.legacyId),
		unique("pages_parent_slug_unique")
			.on(table.ownerId, table.parentId, table.slug)
			.nullsNotDistinct(),
		index("pages_parent_idx").on(table.parentId),
		index("pages_search_idx").using(
			"gin",
			sql`to_tsvector('simple', ${table.title} || ' ' || coalesce(${table.contentMd}, ''))`,
		),
	],
);
