import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { questions } from "./questions.schema";
import { termPairs } from "./term-pairs.schema";

export const questionSources = pgTable("question_sources", {
	questionId: uuid("question_id")
		.primaryKey()
		.references(() => questions.id, { onDelete: "cascade" }),
	termPairId: uuid("term_pair_id")
		.notNull()
		.references(() => termPairs.id, { onDelete: "cascade" }),
	direction: text("direction").notNull(),
});
