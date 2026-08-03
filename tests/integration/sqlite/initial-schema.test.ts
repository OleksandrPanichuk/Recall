import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDatabase } from "@/adapters/persistence/sqlite/database";
import { migrations } from "@/adapters/persistence/sqlite/migrations/index-migrations";
import {
	appliedMigrations,
	runMigrations,
} from "@/adapters/persistence/sqlite/migrations/migration";

let database: Database;

beforeEach(() => {
	database = createDatabase({ path: ":memory:" });
	runMigrations(database, migrations);
});

afterEach(() => {
	database.close();
});

const NOW = "2026-08-03T10:00:00.000Z";

interface QuizSetRow {
	readonly id: string;
	readonly title: string;
	readonly description: string | null;
	readonly language: string;
	readonly source: string | null;
	readonly source_chapters: string | null;
	readonly tags: string;
	readonly status: string;
	readonly created_at: string;
	readonly updated_at: string;
	readonly published_at: string | null;
	readonly archived_at: string | null;
}

interface QuestionRow {
	readonly id: string;
	readonly quiz_set_id: string;
	readonly type: string;
	readonly prompt: string;
	readonly explanation: string | null;
	readonly source_reference: string | null;
	readonly topic: string | null;
	readonly difficulty: string;
	readonly hint: string | null;
	readonly position: number;
	readonly fingerprint: string;
}

interface QuestionOptionRow {
	readonly id: string;
	readonly question_id: string;
	readonly text: string;
	readonly is_correct: number;
	readonly position: number;
}

interface QuizAttemptRow {
	readonly id: string;
	readonly quiz_set_id: string;
	readonly telegram_user_id: number;
	readonly mode: string;
	readonly status: string;
	readonly question_ids: string;
	readonly started_at: string;
	readonly updated_at: string;
	readonly completed_at: string | null;
}

interface QuestionResponseRow {
	readonly attempt_id: string;
	readonly question_id: string;
	readonly selected_option_ids: string;
	readonly is_correct: number;
	readonly answered_at: string;
}

interface ReviewItemRow {
	readonly id: string;
	readonly question_id: string;
	readonly telegram_user_id: number;
	readonly state: string;
	readonly streak: number;
	readonly due_at: string;
	readonly created_at: string;
	readonly last_reviewed_at: string | null;
}

/**
 * Any column of a probe row may be overridden with NULL, including a primary
 * key: proving the schema rejects a NULL identifier is exactly what the
 * identifier tests below do, so the helpers must be able to attempt it.
 */
type Probe<TRow> = { readonly [TKey in keyof TRow]: TRow[TKey] | null };

// Row-inserting helpers. Every constraint test needs a *valid* row except for
// the one column under test, so the defaults below are the schema's happy path
// and each test overrides exactly what it is probing. Each test also gets a
// fresh database from `beforeEach`, so a single-row probe can never collide with
// another test's UNIQUE constraints.

const insertQuizSet = (
	overrides: Partial<Probe<QuizSetRow>> = {},
): Probe<QuizSetRow> => {
	const row: Probe<QuizSetRow> = {
		id: "quiz-set-1",
		title: "Designing Data-Intensive Applications",
		description: null,
		language: "en",
		source: null,
		source_chapters: null,
		tags: "[]",
		status: "draft",
		created_at: NOW,
		updated_at: NOW,
		published_at: null,
		archived_at: null,
		...overrides,
	};

	database.run(
		`INSERT INTO quiz_sets (
			id, title, description, language, source, source_chapters, tags,
			status, created_at, updated_at, published_at, archived_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			row.id,
			row.title,
			row.description,
			row.language,
			row.source,
			row.source_chapters,
			row.tags,
			row.status,
			row.created_at,
			row.updated_at,
			row.published_at,
			row.archived_at,
		],
	);

	return row;
};

const insertQuestion = (
	overrides: Partial<Probe<QuestionRow>> = {},
): Probe<QuestionRow> => {
	const row: Probe<QuestionRow> = {
		id: "question-1",
		quiz_set_id: "quiz-set-1",
		type: "single_choice",
		prompt: "What does replication improve?",
		explanation: null,
		source_reference: null,
		topic: null,
		difficulty: "medium",
		hint: null,
		position: 0,
		fingerprint: "fingerprint-1",
		...overrides,
	};

	database.run(
		`INSERT INTO questions (
			id, quiz_set_id, type, prompt, explanation, source_reference, topic,
			difficulty, hint, position, fingerprint
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			row.id,
			row.quiz_set_id,
			row.type,
			row.prompt,
			row.explanation,
			row.source_reference,
			row.topic,
			row.difficulty,
			row.hint,
			row.position,
			row.fingerprint,
		],
	);

	return row;
};

const insertOption = (
	overrides: Partial<Probe<QuestionOptionRow>> = {},
): Probe<QuestionOptionRow> => {
	const row: Probe<QuestionOptionRow> = {
		id: "option-1",
		question_id: "question-1",
		text: "Availability",
		is_correct: 1,
		position: 0,
		...overrides,
	};

	database.run(
		`INSERT INTO question_options (id, question_id, text, is_correct, position)
		VALUES (?, ?, ?, ?, ?)`,
		[row.id, row.question_id, row.text, row.is_correct, row.position],
	);

	return row;
};

const insertAttempt = (
	overrides: Partial<Probe<QuizAttemptRow>> = {},
): Probe<QuizAttemptRow> => {
	const row: Probe<QuizAttemptRow> = {
		id: "attempt-1",
		quiz_set_id: "quiz-set-1",
		telegram_user_id: 42,
		mode: "full",
		status: "active",
		question_ids: '["question-1"]',
		started_at: NOW,
		updated_at: NOW,
		completed_at: null,
		...overrides,
	};

	database.run(
		`INSERT INTO quiz_attempts (
			id, quiz_set_id, telegram_user_id, mode, status, question_ids,
			started_at, updated_at, completed_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			row.id,
			row.quiz_set_id,
			row.telegram_user_id,
			row.mode,
			row.status,
			row.question_ids,
			row.started_at,
			row.updated_at,
			row.completed_at,
		],
	);

	return row;
};

const insertResponse = (
	overrides: Partial<Probe<QuestionResponseRow>> = {},
): Probe<QuestionResponseRow> => {
	const row: Probe<QuestionResponseRow> = {
		attempt_id: "attempt-1",
		question_id: "question-1",
		selected_option_ids: '["option-1"]',
		is_correct: 1,
		answered_at: NOW,
		...overrides,
	};

	database.run(
		`INSERT INTO question_responses (
			attempt_id, question_id, selected_option_ids, is_correct, answered_at
		) VALUES (?, ?, ?, ?, ?)`,
		[
			row.attempt_id,
			row.question_id,
			row.selected_option_ids,
			row.is_correct,
			row.answered_at,
		],
	);

	return row;
};

const insertReviewItem = (
	overrides: Partial<Probe<ReviewItemRow>> = {},
): Probe<ReviewItemRow> => {
	const row: Probe<ReviewItemRow> = {
		id: "review-item-1",
		question_id: "question-1",
		telegram_user_id: 42,
		state: "pending",
		streak: 0,
		due_at: NOW,
		created_at: NOW,
		last_reviewed_at: null,
		...overrides,
	};

	database.run(
		`INSERT INTO review_items (
			id, question_id, telegram_user_id, state, streak, due_at, created_at,
			last_reviewed_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			row.id,
			row.question_id,
			row.telegram_user_id,
			row.state,
			row.streak,
			row.due_at,
			row.created_at,
			row.last_reviewed_at,
		],
	);

	return row;
};

type TableName =
	| "question_options"
	| "question_responses"
	| "questions"
	| "quiz_attempts"
	| "quiz_sets"
	| "review_items";

// Mutable on purpose: `test.each` takes a mutable array, and a `readonly` one
// makes it infer the case parameter as `unknown`.
const APPLICATION_TABLES: TableName[] = [
	"question_options",
	"question_responses",
	"questions",
	"quiz_attempts",
	"quiz_sets",
	"review_items",
];

const tableNames = (): readonly string[] =>
	database
		.query<{ name: string }, []>(
			`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
		)
		.all()
		.map((row) => row.name);

const indexNames = (): readonly string[] =>
	database
		.query<{ name: string }, []>(
			// SQLite creates an implicit `sqlite_autoindex_*` for every UNIQUE and
			// non-INTEGER primary key; only the explicitly declared indexes are the
			// subject of this assertion.
			`SELECT name FROM sqlite_master
			WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex%'
			ORDER BY name`,
		)
		.all()
		.map((row) => row.name);

const indexColumns = (index: string): readonly string[] =>
	database
		.query<{ name: string }, [string]>(
			`SELECT name FROM pragma_index_info(?) ORDER BY seqno`,
		)
		.all(index)
		.map((row) => row.name);

const tableSql = (table: TableName): string =>
	database
		.query<{ sql: string }, [string]>(
			`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
		)
		.get(table)?.sql ?? "";

/**
 * The planner's own explanation of a read. Values are inlined rather than bound
 * because `EXPLAIN QUERY PLAN` needs no bindings and none of the plans asserted
 * here depend on the value.
 */
const queryPlan = (sql: string): string =>
	database
		.query<{ detail: string }, []>(`EXPLAIN QUERY PLAN ${sql}`)
		.all()
		.map((row) => row.detail)
		.join("\n");

const countOf = (table: TableName): number =>
	database
		.query<{ total: number }, []>(`SELECT COUNT(*) AS total FROM ${table}`)
		.get()?.total ?? -1;

const QUESTION_TYPES = ["single_choice", "multiple_choice", "true_false"];
const DIFFICULTIES = ["easy", "medium", "hard"];
const ATTEMPT_MODES = ["full", "mistakes", "weak_topics"];
const ATTEMPT_STATUSES = ["active", "paused", "completed"];

const product = (
	left: readonly string[],
	right: readonly string[],
): readonly [string, string][] =>
	left.flatMap((leftValue) =>
		right.map((rightValue): [string, string] => [leftValue, rightValue]),
	);

describe("initial schema", () => {
	describe("structure", () => {
		test("creates every expected table", () => {
			expect(tableNames()).toEqual([
				"question_options",
				"question_responses",
				"questions",
				"quiz_attempts",
				"quiz_sets",
				"review_items",
				"schema_migrations",
			]);
		});

		test.each(APPLICATION_TABLES)("declares %s as a STRICT table", (table) => {
			expect(tableSql(table)).toContain("STRICT");
		});
	});

	describe("indexes", () => {
		test("creates exactly the expected explicit indexes", () => {
			expect(indexNames()).toEqual([
				"idx_question_responses_question",
				"idx_quiz_attempts_user_status",
				"idx_quiz_sets_status",
				"idx_review_items_due",
				"idx_review_items_question",
			]);
		});

		// The columns are asserted as well as the name: an index renamed onto the
		// wrong columns would satisfy a name-only assertion.
		test.each([
			["idx_question_responses_question", ["question_id"]],
			["idx_quiz_attempts_user_status", ["telegram_user_id", "status"]],
			["idx_quiz_sets_status", ["status", "updated_at"]],
			["idx_review_items_due", ["telegram_user_id", "due_at"]],
			["idx_review_items_question", ["question_id"]],
		])("indexes %s on %p", (index, columns) => {
			expect(indexColumns(index)).toEqual(columns);
		});

		test("filters quiz sets by status and orders by recency without a sort", () => {
			const plan = queryPlan(
				`SELECT id FROM quiz_sets WHERE status = 'draft'
				ORDER BY updated_at DESC`,
			);

			expect(plan).toContain("idx_quiz_sets_status");
			expect(plan).not.toContain("TEMP B-TREE");
		});

		test("reads the questions of a set in position order without a sort", () => {
			// `idx_questions_quiz_set` was deliberately removed: the implicit index
			// behind UNIQUE (quiz_set_id, position) already serves this read, so this
			// test pins the guarantee rather than an index name.
			const plan = queryPlan(
				`SELECT id FROM questions WHERE quiz_set_id = 'quiz-set-1'
				ORDER BY position`,
			);

			expect(plan).not.toContain("SCAN questions");
			expect(plan).not.toContain("TEMP B-TREE");
		});

		test.each([
			[
				"question_responses",
				`SELECT attempt_id FROM question_responses
				WHERE question_id = 'question-1'`,
			],
			[
				"review_items",
				`SELECT id FROM review_items WHERE question_id = 'question-1'`,
			],
		])("searches %s by question id instead of scanning", (table, sql) => {
			const plan = queryPlan(sql);

			expect(plan).toContain("SEARCH");
			expect(plan).not.toContain(`SCAN ${table}`);
		});
	});

	describe("identifiers", () => {
		// A TEXT PRIMARY KEY does not imply NOT NULL in SQLite, and NULLs compare
		// distinct in a unique index, so without an explicit NOT NULL a database
		// can accumulate unreachable, undeletable rows that no `WHERE id = ?` ever
		// matches and no cascade ever collects.
		test.each([
			["quiz_sets", () => insertQuizSet({ id: null })],
			[
				"questions",
				() => {
					insertQuizSet();
					insertQuestion({ id: null });
				},
			],
			[
				"question_options",
				() => {
					insertQuizSet();
					insertQuestion();
					insertOption({ id: null });
				},
			],
			[
				"quiz_attempts",
				() => {
					insertQuizSet();
					insertAttempt({ id: null });
				},
			],
			[
				"review_items",
				() => {
					insertQuizSet();
					insertQuestion();
					insertReviewItem({ id: null });
				},
			],
		])("rejects a NULL primary key in %s", (_table, insert) => {
			expect(insert).toThrow(/NOT NULL constraint failed/);
		});

		test.each([
			["attempt_id", { attempt_id: null }],
			["question_id", { question_id: null }],
		])("rejects a NULL %s in the question_responses composite key", (_column, overrides) => {
			insertQuizSet();
			insertQuestion();
			insertAttempt();

			expect(() => insertResponse(overrides)).toThrow(
				/NOT NULL constraint failed/,
			);
		});

		test("converts an integer bound to a TEXT identifier into text", () => {
			// Characterisation of a STRICT limitation, not a desired affordance:
			// STRICT does not disable affinity conversion, so a TEXT column still
			// accepts an integer — it just stores it as text. The guarantee that
			// matters downstream survives, and is what this asserts: a mapper always
			// reads a string back, never a number, so `brandedId` cannot be handed a
			// non-string. A BLOB, which has no lossless text form, is refused.
			database.run(
				`INSERT INTO quiz_sets (
					id, title, language, status, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?)`,
				[12345, "Numeric id", "en", "draft", NOW, NOW],
			);

			expect(
				database
					.query<{ id: unknown; kind: string }, []>(
						"SELECT id, typeof(id) AS kind FROM quiz_sets",
					)
					.get(),
			).toEqual({ id: "12345", kind: "text" });
		});

		test("rejects a BLOB in a TEXT column", () => {
			expect(() =>
				database.run(
					`INSERT INTO quiz_sets (
						id, title, language, status, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?)`,
					[new Uint8Array([1, 2]), "Blob id", "en", "draft", NOW, NOW],
				),
			).toThrow(/cannot store BLOB value in TEXT column/);
		});

		test.each([
			["a non-numeric text", "forty-two", /cannot store TEXT value/],
			["a fractional number", 1.5, /cannot store REAL value/],
		])("rejects %s telegram user id in an INTEGER column", (_label, userId, message) => {
			insertQuizSet();

			expect(() =>
				database.run(
					`INSERT INTO quiz_attempts (
							id, quiz_set_id, telegram_user_id, mode, status, question_ids,
							started_at, updated_at
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					["attempt-1", "quiz-set-1", userId, "full", "active", "[]", NOW, NOW],
				),
			).toThrow(message);
		});
	});

	describe("column defaults", () => {
		test("defaults quiz set tags to an empty JSON array", () => {
			database.run(
				`INSERT INTO quiz_sets (
					id, title, language, status, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?)`,
				["quiz-set-1", "Untagged", "en", "draft", NOW, NOW],
			);

			expect(
				database.query<{ tags: string }, []>("SELECT tags FROM quiz_sets").get()
					?.tags,
			).toBe("[]");
		});

		test("defaults a review item streak to zero", () => {
			insertQuizSet();
			insertQuestion();
			database.run(
				`INSERT INTO review_items (
					id, question_id, telegram_user_id, state, due_at, created_at
				) VALUES (?, ?, ?, ?, ?, ?)`,
				["review-item-1", "question-1", 42, "pending", NOW, NOW],
			);

			expect(
				database
					.query<{ streak: number }, []>("SELECT streak FROM review_items")
					.get()?.streak,
			).toBe(0);
		});
	});

	describe("accepted enum values", () => {
		// The negative CHECK tests below cannot catch a typo in a CHECK list that
		// rejects a LEGAL value, so every legal value is inserted here too.
		test.each([
			"draft",
			"published",
			"archived",
		])("accepts the quiz set status %s", (status) => {
			insertQuizSet({ status });

			expect(countOf("quiz_sets")).toBe(1);
		});

		test.each(
			product(QUESTION_TYPES, DIFFICULTIES),
		)("accepts a %s question of %s difficulty", (type, difficulty) => {
			insertQuizSet();
			insertQuestion({ type, difficulty });

			expect(countOf("questions")).toBe(1);
		});

		test.each(
			product(ATTEMPT_MODES, ATTEMPT_STATUSES),
		)("accepts a %s attempt in state %s", (mode, status) => {
			insertQuizSet();
			insertAttempt({ mode, status });

			expect(countOf("quiz_attempts")).toBe(1);
		});

		test.each([
			"pending",
			"learning",
			"retired",
		])("accepts the review item state %s", (state) => {
			insertQuizSet();
			insertQuestion();
			insertReviewItem({ state });

			expect(countOf("review_items")).toBe(1);
		});

		test.each([0, 1])("accepts the option correctness flag %p", (isCorrect) => {
			insertQuizSet();
			insertQuestion();
			insertOption({ is_correct: isCorrect });

			expect(countOf("question_options")).toBe(1);
		});

		test.each([
			0, 1,
		])("accepts the response correctness flag %p", (isCorrect) => {
			insertQuizSet();
			insertQuestion();
			insertAttempt();
			insertResponse({ is_correct: isCorrect });

			expect(countOf("question_responses")).toBe(1);
		});

		test.each([0, 4])("accepts the review streak %p", (streak) => {
			insertQuizSet();
			insertQuestion();
			insertReviewItem({ streak });

			expect(countOf("review_items")).toBe(1);
		});
	});

	describe("check constraints", () => {
		test("rejects an unknown quiz set status", () => {
			expect(() => insertQuizSet({ status: "publishing" })).toThrow(
				/CHECK constraint failed/,
			);
		});

		test("rejects an unknown question type", () => {
			insertQuizSet();

			expect(() => insertQuestion({ type: "essay" })).toThrow(
				/CHECK constraint failed/,
			);
		});

		test("rejects an unknown question difficulty", () => {
			insertQuizSet();

			expect(() => insertQuestion({ difficulty: "expert" })).toThrow(
				/CHECK constraint failed/,
			);
		});

		test("rejects a question option correctness flag outside 0 and 1", () => {
			insertQuizSet();
			insertQuestion();

			expect(() => insertOption({ is_correct: 2 })).toThrow(
				/CHECK constraint failed/,
			);
		});

		test("rejects an unknown attempt mode", () => {
			insertQuizSet();

			expect(() => insertAttempt({ mode: "revision" })).toThrow(
				/CHECK constraint failed/,
			);
		});

		test("rejects an unknown attempt status", () => {
			insertQuizSet();

			expect(() => insertAttempt({ status: "abandoned" })).toThrow(
				/CHECK constraint failed/,
			);
		});

		test("rejects a response correctness flag outside 0 and 1", () => {
			insertQuizSet();
			insertQuestion();
			insertAttempt();

			expect(() => insertResponse({ is_correct: -1 })).toThrow(
				/CHECK constraint failed/,
			);
		});

		test("rejects an unknown review item state", () => {
			insertQuizSet();
			insertQuestion();

			expect(() => insertReviewItem({ state: "mastered" })).toThrow(
				/CHECK constraint failed/,
			);
		});

		test("rejects a negative review streak", () => {
			insertQuizSet();
			insertQuestion();

			expect(() => insertReviewItem({ streak: -1 })).toThrow(
				/CHECK constraint failed/,
			);
		});
	});

	describe("foreign keys", () => {
		test("rejects a question whose quiz set does not exist", () => {
			expect(() => insertQuestion({ quiz_set_id: "missing" })).toThrow(
				/FOREIGN KEY constraint failed/,
			);
		});

		test("rejects an option whose question does not exist", () => {
			expect(() => insertOption({ question_id: "missing" })).toThrow(
				/FOREIGN KEY constraint failed/,
			);
		});

		test("rejects an attempt whose quiz set does not exist", () => {
			expect(() => insertAttempt({ quiz_set_id: "missing" })).toThrow(
				/FOREIGN KEY constraint failed/,
			);
		});

		test("rejects a response whose attempt does not exist", () => {
			insertQuizSet();
			insertQuestion();

			expect(() => insertResponse({ attempt_id: "missing" })).toThrow(
				/FOREIGN KEY constraint failed/,
			);
		});

		test("rejects a review item whose question does not exist", () => {
			expect(() => insertReviewItem({ question_id: "missing" })).toThrow(
				/FOREIGN KEY constraint failed/,
			);
		});
	});

	describe("cascading deletes", () => {
		test("deletes questions and options when their quiz set is deleted", () => {
			insertQuizSet();
			insertQuestion();
			insertOption();
			insertOption({ id: "option-2", is_correct: 0, position: 1 });

			database.run("DELETE FROM quiz_sets WHERE id = ?", ["quiz-set-1"]);

			expect(countOf("questions")).toBe(0);
			expect(countOf("question_options")).toBe(0);
		});

		test("deletes attempts and responses when their quiz set is deleted", () => {
			insertQuizSet();
			insertQuestion();
			insertAttempt();
			insertResponse();

			database.run("DELETE FROM quiz_sets WHERE id = ?", ["quiz-set-1"]);

			expect(countOf("quiz_attempts")).toBe(0);
			expect(countOf("question_responses")).toBe(0);
		});

		test("deletes review items through the questions of a deleted quiz set", () => {
			// Two cascade hops in one delete: quiz_sets -> questions -> review_items.
			insertQuizSet();
			insertQuestion();
			insertReviewItem();

			database.run("DELETE FROM quiz_sets WHERE id = ?", ["quiz-set-1"]);

			expect(countOf("questions")).toBe(0);
			expect(countOf("review_items")).toBe(0);
		});

		test("deletes options, responses and review items when a question is deleted", () => {
			insertQuizSet();
			insertQuestion();
			insertOption();
			insertAttempt();
			insertResponse();
			insertReviewItem();

			database.run("DELETE FROM questions WHERE id = ?", ["question-1"]);

			expect(countOf("question_options")).toBe(0);
			expect(countOf("question_responses")).toBe(0);
			expect(countOf("review_items")).toBe(0);
		});
	});

	describe("unique constraints", () => {
		test("rejects two questions with the same fingerprint in one quiz set", () => {
			insertQuizSet();
			insertQuestion();

			expect(() => insertQuestion({ id: "question-2", position: 1 })).toThrow(
				/UNIQUE constraint failed/,
			);
		});

		test("allows the same fingerprint in a different quiz set", () => {
			insertQuizSet();
			insertQuizSet({ id: "quiz-set-2" });
			insertQuestion();
			insertQuestion({ id: "question-2", quiz_set_id: "quiz-set-2" });

			expect(countOf("questions")).toBe(2);
		});

		test("rejects two questions at the same position in one quiz set", () => {
			insertQuizSet();
			insertQuestion();

			expect(() =>
				insertQuestion({ id: "question-2", fingerprint: "fingerprint-2" }),
			).toThrow(/UNIQUE constraint failed/);
		});

		test("rejects two options at the same position in one question", () => {
			insertQuizSet();
			insertQuestion();
			insertOption();

			expect(() => insertOption({ id: "option-2", is_correct: 0 })).toThrow(
				/UNIQUE constraint failed/,
			);
		});

		test("rejects a second response for the same attempt and question", () => {
			insertQuizSet();
			insertQuestion();
			insertAttempt();
			insertResponse();

			expect(() => insertResponse({ is_correct: 0 })).toThrow(
				/UNIQUE constraint failed/,
			);
		});

		test("rejects two review items for the same user and question", () => {
			insertQuizSet();
			insertQuestion();
			insertReviewItem();

			expect(() => insertReviewItem({ id: "review-item-2" })).toThrow(
				/UNIQUE constraint failed/,
			);
		});
	});

	describe("idempotence", () => {
		test("applies one migration and then none", () => {
			// `beforeEach` already migrated this database, so the first call here is
			// the repeat run an operator triggers with `bun run migrate`.
			expect(runMigrations(database, migrations)).toHaveLength(0);
			expect(appliedMigrations(database).map((entry) => entry.version)).toEqual(
				[1],
			);
		});

		test("applies exactly one migration to a fresh database", () => {
			const fresh = createDatabase({ path: ":memory:" });

			try {
				expect(runMigrations(fresh, migrations)).toEqual([
					{
						version: 1,
						name: "initial-schema",
						appliedAt: expect.any(String),
					},
				]);
				expect(runMigrations(fresh, migrations)).toHaveLength(0);
			} finally {
				fresh.close();
			}
		});
	});
});
