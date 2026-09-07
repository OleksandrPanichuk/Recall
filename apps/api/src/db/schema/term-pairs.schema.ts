import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, deletedAt, updatedAt } from "./columns";
import { ownerId } from "./owner-id";
import { quizzes } from "./quizzes.schema";

export const termPairs = pgTable(
	"term_pairs",
	{
		ownerId: ownerId(),
		id: uuid("id").primaryKey(),
		legacyId: text("legacy_id"),
		quizId: uuid("quiz_id")
			.notNull()
			.references(() => quizzes.id, { onDelete: "cascade" }),
		terms: text("terms").array().notNull(),
		translations: text("translations").array().notNull(),
		transcription: text("transcription"),
		example: text("example"),
		topic: text("topic"),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		deletedAt: deletedAt(),
	},
	(table) => [
		index("term_pairs_owner_idx").on(table.ownerId),
		unique("term_pairs_legacy_unique").on(table.ownerId, table.legacyId),
		index("term_pairs_quiz_idx").on(table.quizId),
	],
);
