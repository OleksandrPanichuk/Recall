import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	pgTable,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { createdAt, deletedAt, updatedAt } from "./columns";
import { ownerId } from "./owner-id";
import { quizzes } from "./quizzes.schema";

export const questions = pgTable(
	"questions",
	{
		ownerId: ownerId(),
		id: uuid("id").primaryKey(),
		legacyId: text("legacy_id"),
		quizId: uuid("quiz_id")
			.notNull()
			.references(() => quizzes.id, { onDelete: "restrict" }),
		type: text("type").notNull(),
		prompt: text("prompt").notNull(),
		explanation: text("explanation"),
		sourceReference: text("source_reference"),
		topic: text("topic"),
		difficulty: text("difficulty").notNull(),
		hint: text("hint"),
		vocabularyItemId: uuid("vocabulary_item_id"),
		position: integer("position").notNull(),
		fingerprint: text("fingerprint").notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		deletedAt: deletedAt(),
	},
	(table) => [
		index("questions_owner_idx").on(table.ownerId),
		unique("questions_legacy_unique").on(table.ownerId, table.legacyId),
		check(
			"questions_difficulty_check",
			sql`${table.difficulty} in ('easy', 'medium', 'hard')`,
		),
		unique("questions_quiz_position_unique").on(table.quizId, table.position),
		unique("questions_quiz_fingerprint_unique").on(
			table.quizId,
			table.fingerprint,
		),
	],
);
