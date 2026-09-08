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
import { updatedAt } from "./columns";
import { ownerId } from "./owner-id";
import { quizzes } from "./quizzes.schema";

export const attempts = pgTable(
	"attempts",
	{
		ownerId: ownerId(),
		id: uuid("id").primaryKey(),
		legacyId: text("legacy_id"),
		quizId: uuid("quiz_id")
			.notNull()
			.references(() => quizzes.id, { onDelete: "cascade" }),
		telegramUserId: integer("telegram_user_id"),
		mode: text("mode").notNull(),
		status: text("status").notNull(),
		startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
		updatedAt: updatedAt(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		index("attempts_owner_idx").on(table.ownerId),
		unique("attempts_legacy_unique").on(table.ownerId, table.legacyId),
		check(
			"attempts_status_check",
			sql`${table.status} in ('active', 'paused', 'completed')`,
		),
		index("attempts_quiz_status_idx").on(table.quizId, table.status),
	],
);
