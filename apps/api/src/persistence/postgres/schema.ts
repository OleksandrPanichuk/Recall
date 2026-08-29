import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	check,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

const createdAt = () =>
	timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
	timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const deletedAt = () => timestamp("deleted_at", { withTimezone: true });
const ownerId = () =>
	text("owner_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" });

export const pages = pgTable(
	"pages",
	{
		ownerId: ownerId(),
		id: uuid("id").primaryKey(),
		legacyId: text("legacy_id"),
		parentId: uuid("parent_id").references((): AnyPgColumn => pages.id, {
			onDelete: "restrict",
		}),
		title: text("title").notNull(),
		slug: text("slug").notNull(),
		icon: text("icon"),
		contentMd: text("content_md"),
		position: numeric("position", { precision: 20, scale: 10 })
			.notNull()
			.default("0"),
		visibility: text("visibility").notNull().default("private"),
		version: integer("version").notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		deletedAt: deletedAt(),
	},
	(table) => [
		index("pages_owner_idx").on(table.ownerId),
		unique("pages_legacy_unique").on(table.ownerId, table.legacyId),
		unique("pages_parent_slug_unique")
			.on(table.ownerId, table.parentId, table.slug)
			.nullsNotDistinct(),
		check(
			"pages_visibility_check",
			sql`${table.visibility} in ('private', 'unlisted', 'public')`,
		),
		index("pages_parent_idx").on(table.parentId),
		index("pages_search_idx").using(
			"gin",
			sql`to_tsvector('simple', ${table.title} || ' ' || coalesce(${table.contentMd}, ''))`,
		),
	],
);

export const pageRevisions = pgTable(
	"page_revisions",
	{
		id: uuid("id").primaryKey(),
		pageId: uuid("page_id")
			.notNull()
			.references(() => pages.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		contentMd: text("content_md"),
		authorKind: text("author_kind").notNull().default("user"),
		createdAt: createdAt(),
	},
	(table) => [
		index("page_revisions_page_idx").on(table.pageId, table.createdAt),
		check(
			"page_revisions_author_check",
			sql`${table.authorKind} in ('user', 'mcp')`,
		),
	],
);

export const quizzes = pgTable(
	"quizzes",
	{
		ownerId: ownerId(),
		id: uuid("id").primaryKey(),
		legacyId: text("legacy_id"),
		pageId: uuid("page_id").references(() => pages.id, {
			onDelete: "set null",
		}),
		title: text("title").notNull(),
		description: text("description"),
		language: text("language").notNull(),
		source: text("source"),
		sourceChapters: text("source_chapters"),
		tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
		status: text("status").notNull(),
		visibility: text("visibility").notNull().default("private"),
		version: integer("version").notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		deletedAt: deletedAt(),
	},
	(table) => [
		index("quizzes_owner_idx").on(table.ownerId),
		unique("quizzes_legacy_unique").on(table.ownerId, table.legacyId),
		check(
			"quizzes_status_check",
			sql`${table.status} in ('draft', 'published', 'archived')`,
		),
		check(
			"quizzes_visibility_check",
			sql`${table.visibility} in ('private', 'unlisted', 'public')`,
		),
		index("quizzes_status_idx").on(table.status, table.updatedAt),
		index("quizzes_page_idx").on(table.pageId),
	],
);

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

export const questionSources = pgTable("question_sources", {
	questionId: uuid("question_id")
		.primaryKey()
		.references(() => questions.id, { onDelete: "cascade" }),
	termPairId: uuid("term_pair_id")
		.notNull()
		.references(() => termPairs.id, { onDelete: "cascade" }),
	direction: text("direction").notNull(),
});

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
		answeredAt: timestamp("answered_at", { withTimezone: true }).notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.attemptId, table.questionId] }),
		index("responses_question_idx").on(table.questionId),
	],
);

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

export const studySettings = pgTable(
	"study_settings",
	{
		ownerId: ownerId(),
		id: uuid("id").primaryKey(),
		scopeType: text("scope_type").notNull(),
		scopeId: uuid("scope_id"),
		intervalsDays: integer("intervals_days").array().notNull(),
		maxIntervalDays: integer("max_interval_days").notNull(),
		maxRepetitions: integer("max_repetitions").notNull(),
		shuffleOptions: boolean("shuffle_options").notNull().default(false),
		shuffleQuestions: boolean("shuffle_questions").notNull().default(false),
		examMode: boolean("exam_mode").notNull().default(false),
		updatedAt: updatedAt(),
	},
	(table) => [
		index("study_settings_owner_idx").on(table.ownerId),
		index("review_states_owner_idx").on(table.ownerId),
		check(
			"study_settings_scope_check",
			sql`${table.scopeType} in ('owner', 'page', 'quiz')`,
		),
		unique("study_settings_scope_unique")
			.on(table.ownerId, table.scopeType, table.scopeId)
			.nullsNotDistinct(),
	],
);

export {
	account,
	apiTokens,
	authEvents,
	oauthClients,
	oauthCodes,
	oauthTokens,
	session,
	user,
	verification,
} from "./auth-schema";
