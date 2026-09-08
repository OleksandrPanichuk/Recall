import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { attempts } from "./attempts.schema";
import { questions } from "./questions.schema";

export const responses = pgTable(
	"responses",
	{
		attemptId: uuid("attempt_id")
			.notNull()
			.references(() => attempts.id, { onDelete: "cascade" }),
		questionId: uuid("question_id")
			.notNull()
			.references(() => questions.id, { onDelete: "restrict" }),
		selectedOptionIds: uuid("selected_option_ids").array().notNull(),
		isCorrect: boolean("is_correct").notNull(),
		typedAnswer: text("typed_answer"),
		skipped: boolean("skipped").notNull().default(false),
		creditEarned: integer("credit_earned"),
		creditPossible: integer("credit_possible"),
		recall: text("recall"),
		answeredAt: timestamp("answered_at", { withTimezone: true }).notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.attemptId, table.questionId] }),
		index("responses_question_idx").on(table.questionId),
		check(
			"responses_recall_check",
			sql`${table.recall} is null or ${table.recall} in ('hard', 'good', 'easy')`,
		),
	],
);
