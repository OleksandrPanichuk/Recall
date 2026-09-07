import {
	boolean,
	integer,
	pgTable,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { questions } from "./questions.schema";

export const questionOptions = pgTable(
	"question_options",
	{
		id: uuid("id").primaryKey(),
		legacyId: text("legacy_id"),
		questionId: uuid("question_id")
			.notNull()
			.references(() => questions.id, { onDelete: "cascade" }),
		text: text("text").notNull(),
		isCorrect: boolean("is_correct").notNull(),
		matchKey: text("match_key"),
		position: integer("position").notNull(),
	},
	(table) => [
		unique("question_options_legacy_unique").on(table.legacyId),
		unique("question_options_question_position_unique").on(
			table.questionId,
			table.position,
		),
	],
);
