import type { Migration } from "./migration";

/**
 * The whole quiz schema in one statement list. `up` issues DDL only: the runner
 * already wraps this migration and its ledger insert in a single transaction,
 * so nothing here may open, commit or roll one back.
 */
const statements = [
	`CREATE TABLE quiz_sets (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		description TEXT,
		language TEXT NOT NULL,
		source TEXT,
		source_chapters TEXT,
		tags TEXT NOT NULL DEFAULT '[]',
		status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		published_at TEXT,
		archived_at TEXT
	)`,
	`CREATE TABLE questions (
		id TEXT PRIMARY KEY,
		quiz_set_id TEXT NOT NULL REFERENCES quiz_sets (id) ON DELETE CASCADE,
		type TEXT NOT NULL CHECK (
			type IN ('single_choice', 'multiple_choice', 'true_false')
		),
		prompt TEXT NOT NULL,
		explanation TEXT,
		source_reference TEXT,
		topic TEXT,
		difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
		hint TEXT,
		position INTEGER NOT NULL,
		fingerprint TEXT NOT NULL,
		UNIQUE (quiz_set_id, position),
		-- A retried authoring batch must not be able to store the same question
		-- twice; the fingerprint is what makes that import idempotent.
		UNIQUE (quiz_set_id, fingerprint)
	)`,
	`CREATE TABLE question_options (
		id TEXT PRIMARY KEY,
		question_id TEXT NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
		text TEXT NOT NULL,
		is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
		position INTEGER NOT NULL,
		UNIQUE (question_id, position)
	)`,
	`CREATE TABLE quiz_attempts (
		id TEXT PRIMARY KEY,
		quiz_set_id TEXT NOT NULL REFERENCES quiz_sets (id) ON DELETE CASCADE,
		telegram_user_id INTEGER NOT NULL,
		mode TEXT NOT NULL CHECK (mode IN ('full', 'mistakes', 'weak_topics')),
		status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed')),
		question_ids TEXT NOT NULL,
		started_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		completed_at TEXT
	)`,
	// No surrogate id on purpose: the composite primary key IS the
	// database-level guarantee that one question is scored exactly once per
	// attempt, so a duplicated Telegram callback cannot double-count an answer.
	`CREATE TABLE question_responses (
		attempt_id TEXT NOT NULL REFERENCES quiz_attempts (id) ON DELETE CASCADE,
		question_id TEXT NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
		selected_option_ids TEXT NOT NULL,
		is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
		answered_at TEXT NOT NULL,
		PRIMARY KEY (attempt_id, question_id)
	)`,
	`CREATE TABLE review_items (
		id TEXT PRIMARY KEY,
		question_id TEXT NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
		telegram_user_id INTEGER NOT NULL,
		state TEXT NOT NULL CHECK (state IN ('pending', 'learning', 'retired')),
		streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
		due_at TEXT NOT NULL,
		created_at TEXT NOT NULL,
		last_reviewed_at TEXT,
		-- One review item per user and question, so repeated wrong answers update
		-- a single row instead of growing an unbounded queue.
		UNIQUE (telegram_user_id, question_id)
	)`,
	`CREATE INDEX idx_quiz_sets_status ON quiz_sets (status)`,
	`CREATE INDEX idx_questions_quiz_set ON questions (quiz_set_id, position)`,
	`CREATE INDEX idx_quiz_attempts_user_status
		ON quiz_attempts (telegram_user_id, status)`,
	`CREATE INDEX idx_review_items_due ON review_items (telegram_user_id, due_at)`,
] as const;

export const initialSchema: Migration = {
	version: 1,
	name: "initial-schema",
	up: (database) => {
		for (const statement of statements) {
			database.run(statement);
		}
	},
};
