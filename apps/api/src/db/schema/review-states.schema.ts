import {
	index,
	integer,
	numeric,
	pgTable,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./columns";
import { ownerId } from "./owner-id";
import { questions } from "./questions.schema";

export const reviewStates = pgTable(
	"review_states",
	{
		ownerId: ownerId(),
		questionId: uuid("question_id")
			.primaryKey()
			.references(() => questions.id, { onDelete: "cascade" }),
		telegramUserId: integer("telegram_user_id"),
		repetitionCount: integer("repetition_count").notNull().default(0),
		lapses: integer("lapses").notNull().default(0),
		intervalDays: integer("interval_days"),
		stability: numeric("stability", { precision: 10, scale: 4 }),
		difficulty: numeric("difficulty", { precision: 10, scale: 4 }),
		lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
		dueAt: timestamp("due_at", { withTimezone: true }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [index("review_states_due_idx").on(table.dueAt)],
);
