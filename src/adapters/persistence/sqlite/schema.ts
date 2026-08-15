import { sql } from "drizzle-orm";
import {
	type AnySQLiteColumn,
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	unique,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
	QuizAttemptMode,
	QuizAttemptStatus,
} from "@/domain/quiz-attempt/quiz-attempt";
import { Difficulty } from "@/domain/quiz-set/question";
import { QuizSetStatus } from "@/domain/quiz-set/quiz-set";

function quoteText(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

function isOneOf(
	column: AnySQLiteColumn,
	values: Readonly<Record<string, string>>,
) {
	const allowed = Object.values(values).map(quoteText).join(", ");

	return sql.raw(`${column.name} IN (${allowed})`);
}

function isBoolean(column: AnySQLiteColumn) {
	return sql.raw(`${column.name} IN (0, 1)`);
}

export const folders = sqliteTable(
	"folders",
	{
		id: text("id").notNull().primaryKey(),
		name: text("name").notNull(),
		parentId: text("parent_id").references((): AnySQLiteColumn => folders.id, {
			onDelete: "restrict",
		}),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
	},
	(table) => [
		unique().on(table.parentId, table.name),
		uniqueIndex("folders_root_name_unique")
			.on(table.name)
			.where(sql`parent_id IS NULL`),
	],
);

export const quizSets = sqliteTable(
	"quiz_sets",
	{
		id: text("id").notNull().primaryKey(),
		// drizzle-kit drops ON DELETE when generating ALTER TABLE ADD COLUMN
		folderId: text("folder_id").references(() => folders.id),
		title: text("title").notNull(),
		description: text("description"),
		language: text("language").notNull(),
		source: text("source"),
		sourceChapters: text("source_chapters"),
		tags: text("tags").notNull().default("[]"),
		status: text("status").notNull(),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
		publishedAt: text("published_at"),
		archivedAt: text("archived_at"),
	},
	(table) => [
		check("quiz_sets_status_check", isOneOf(table.status, QuizSetStatus)),
		index("idx_quiz_sets_status").on(table.status, table.updatedAt),
	],
);

export const questions = sqliteTable(
	"questions",
	{
		id: text("id").notNull().primaryKey(),
		quizSetId: text("quiz_set_id")
			.notNull()
			.references(() => quizSets.id, { onDelete: "cascade" }),
		type: text("type").notNull(),
		prompt: text("prompt").notNull(),
		explanation: text("explanation"),
		sourceReference: text("source_reference"),
		topic: text("topic"),
		difficulty: text("difficulty").notNull(),
		hint: text("hint"),
		position: integer("position").notNull(),
		fingerprint: text("fingerprint").notNull(),
	},
	(table) => [
		check("questions_difficulty_check", isOneOf(table.difficulty, Difficulty)),
		unique().on(table.quizSetId, table.position),
		unique().on(table.quizSetId, table.fingerprint),
	],
);

export const questionOptions = sqliteTable(
	"question_options",
	{
		id: text("id").notNull().primaryKey(),
		questionId: text("question_id")
			.notNull()
			.references(() => questions.id, { onDelete: "cascade" }),
		text: text("text").notNull(),
		isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
		matchKey: text("match_key"),
		position: integer("position").notNull(),
	},
	(table) => [
		check("question_options_is_correct_check", isBoolean(table.isCorrect)),
		unique().on(table.questionId, table.position),
	],
);

export const quizAttempts = sqliteTable(
	"quiz_attempts",
	{
		id: text("id").notNull().primaryKey(),
		quizSetId: text("quiz_set_id")
			.notNull()
			.references(() => quizSets.id, { onDelete: "cascade" }),
		telegramUserId: integer("telegram_user_id").notNull(),
		mode: text("mode").notNull(),
		status: text("status").notNull(),
		questionIds: text("question_ids").notNull(),
		startedAt: text("started_at").notNull(),
		updatedAt: text("updated_at").notNull(),
		completedAt: text("completed_at"),
	},
	(table) => [
		check("quiz_attempts_mode_check", isOneOf(table.mode, QuizAttemptMode)),
		check(
			"quiz_attempts_status_check",
			isOneOf(table.status, QuizAttemptStatus),
		),
		index("idx_quiz_attempts_user_status").on(
			table.telegramUserId,
			table.status,
		),
	],
);

export const questionResponses = sqliteTable(
	"question_responses",
	{
		attemptId: text("attempt_id")
			.notNull()
			.references(() => quizAttempts.id, { onDelete: "cascade" }),
		questionId: text("question_id")
			.notNull()
			.references(() => questions.id, { onDelete: "cascade" }),
		selectedOptionIds: text("selected_option_ids").notNull(),
		isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
		typedAnswer: text("typed_answer"),
		skipped: integer("skipped", { mode: "boolean" }),
		answeredAt: text("answered_at").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.attemptId, table.questionId] }),
		check("question_responses_is_correct_check", isBoolean(table.isCorrect)),
		index("idx_question_responses_question").on(table.questionId),
	],
);
