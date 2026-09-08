import {
	index,
	integer,
	pgTable,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { createdAt } from "./columns";
import { ownerId } from "./owner-id";

export const attachments = pgTable(
	"attachments",
	{
		ownerId: ownerId(),
		id: uuid("id").primaryKey(),
		objectKey: text("object_key").notNull(),
		contentType: text("content_type").notNull(),
		size: integer("size").notNull(),
		originalName: text("original_name"),
		createdAt: createdAt(),
	},
	(table) => [
		index("attachments_owner_idx").on(table.ownerId),
		unique("attachments_object_unique").on(table.objectKey),
	],
);
