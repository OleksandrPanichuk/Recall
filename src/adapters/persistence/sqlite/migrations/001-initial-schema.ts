import type { Migration } from "./migration";

/**
 * The whole quiz schema in one statement list. `up` issues DDL only: the runner
 * already wraps this migration and its ledger insert in a single transaction,
 * so nothing here may open, commit or roll one back.
 *
 * Every table is `STRICT`, and every TEXT primary key carries an explicit
 * `NOT NULL`. Both are load-bearing rather than stylistic. A non-INTEGER
 * `PRIMARY KEY` does not imply `NOT NULL` in SQLite and NULLs compare distinct
 * in a unique index, so a plain `id TEXT PRIMARY KEY` accepts any number of
 * NULL-id rows — rows that `WHERE id = ?` can never match, that a retried
 * import keeps duplicating instead of hitting `UNIQUE`, and that no cascade ever
 * collects. `STRICT` additionally stops type affinity from silently coercing an
 * integer `12345` into the string `"12345"`, which would then hydrate as a
 * valid-looking identifier in a mapper.
 */
const statements = [
	`CREATE TABLE quiz_sets (
		id TEXT NOT NULL PRIMARY KEY,
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
	) STRICT`,
	`CREATE TABLE questions (
		id TEXT NOT NULL PRIMARY KEY,
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
		-- The implicit index behind this constraint already serves the "questions
		-- of a set, ordered by position" read, so do not add a separate index on
		-- (quiz_set_id, position): it would be an exact duplicate that costs a
		-- second B-tree write on every insert for no read benefit.
		UNIQUE (quiz_set_id, position),
		-- A retried authoring batch must not be able to store the same question
		-- twice; the fingerprint is what makes that import idempotent.
		UNIQUE (quiz_set_id, fingerprint)
	) STRICT`,
	`CREATE TABLE question_options (
		id TEXT NOT NULL PRIMARY KEY,
		question_id TEXT NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
		text TEXT NOT NULL,
		is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
		position INTEGER NOT NULL,
		UNIQUE (question_id, position)
	) STRICT`,
	`CREATE TABLE quiz_attempts (
		id TEXT NOT NULL PRIMARY KEY,
		quiz_set_id TEXT NOT NULL REFERENCES quiz_sets (id) ON DELETE CASCADE,
		telegram_user_id INTEGER NOT NULL,
		mode TEXT NOT NULL CHECK (mode IN ('full', 'mistakes', 'weak_topics')),
		status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed')),
		question_ids TEXT NOT NULL,
		started_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		completed_at TEXT
	) STRICT`,
	// No surrogate id on purpose: the composite primary key IS the database-level
	// guarantee that one question is scored exactly once per attempt, so a
	// duplicated Telegram callback cannot double-count an answer.
	//
	// Accepted limitation: nothing here constrains a response's question to its
	// attempt's plan. `question_ids` is a JSON blob a CHECK cannot subquery, and
	// the quiz-set-level variant would need a denormalised column plus composite
	// foreign keys to guard an invariant the `QuizAttempt` aggregate already owns
	// as its sole writer. That invariant is enforced in the domain.
	`CREATE TABLE question_responses (
		attempt_id TEXT NOT NULL REFERENCES quiz_attempts (id) ON DELETE CASCADE,
		question_id TEXT NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
		selected_option_ids TEXT NOT NULL,
		is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
		answered_at TEXT NOT NULL,
		PRIMARY KEY (attempt_id, question_id)
	) STRICT`,
	`CREATE TABLE review_items (
		id TEXT NOT NULL PRIMARY KEY,
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
	) STRICT`,
	// `updated_at` is part of this index so the Phase 1.3 listing read
	// (`WHERE status = ? ORDER BY updated_at DESC`) is satisfied by the index
	// alone; on `(status)` only, SQLite adds a temp B-tree for the ordering.
	`CREATE INDEX idx_quiz_sets_status ON quiz_sets (status, updated_at)`,
	`CREATE INDEX idx_quiz_attempts_user_status
		ON quiz_attempts (telegram_user_id, status)`,
	`CREATE INDEX idx_review_items_due ON review_items (telegram_user_id, due_at)`,
	// Both child tables are reachable by a leading `question_id` that no other
	// constraint indexes: `question_responses`' composite primary key leads with
	// `attempt_id`, and `review_items`' UNIQUE leads with the user id. Without
	// these, every `DELETE FROM questions` full-scans both tables per deleted row.
	`CREATE INDEX idx_question_responses_question
		ON question_responses (question_id)`,
	`CREATE INDEX idx_review_items_question ON review_items (question_id)`,
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
