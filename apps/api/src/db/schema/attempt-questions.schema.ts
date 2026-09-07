import {
	integer,
	jsonb,
	pgTable,
	primaryKey,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { attempts } from "./attempts.schema";
import { questions } from "./questions.schema";

export const attemptQuestions = pgTable(
	"attempt_questions",
	{
		attemptId: uuid("attempt_id")
			.notNull()
			.references(() => attempts.id, { onDelete: "cascade" }),
		position: integer("position").notNull(),
		questionId: uuid("question_id")
			.notNull()
			.references(() => questions.id, { onDelete: "restrict" }),
		presentedOptionOrder: jsonb("presented_option_order"),
	},
	(table) => [
		primaryKey({ columns: [table.attemptId, table.position] }),
		unique("attempt_questions_attempt_question_unique").on(
			table.attemptId,
			table.questionId,
		),
	],
);
