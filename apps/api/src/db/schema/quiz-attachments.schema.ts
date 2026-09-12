import { index, numeric, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { createdAt } from "./columns";
import { pages } from "./pages.schema";
import { quizzes } from "./quizzes.schema";

export const quizAttachments = pgTable(
	"quiz_attachments",
	{
		pageId: uuid("page_id")
			.notNull()
			.references(() => pages.id, { onDelete: "cascade" }),
		quizId: uuid("quiz_id")
			.notNull()
			.references(() => quizzes.id, { onDelete: "cascade" }),
		position: numeric("position", { precision: 20, scale: 10 })
			.notNull()
			.default("0"),
		createdAt: createdAt(),
	},
	(table) => [
		primaryKey({ columns: [table.pageId, table.quizId] }),
		index("quiz_attachments_quiz_idx").on(table.quizId),
	],
);
