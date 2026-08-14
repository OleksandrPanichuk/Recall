import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	QuizAttemptMode,
	QuizAttemptStatus,
} from "@/domain/quiz-attempt/quiz-attempt";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import { QuizSetStatus } from "@/domain/quiz-set/quiz-set";
import {
	applicationTables,
	countRows,
	insertQuestion,
	insertQuestionOption,
	insertQuestionResponse,
	insertQuizAttempt,
	insertQuizSet,
	openMigratedDatabase,
	tableDefinition,
} from "./migrated-database";

let database: Database;

beforeEach(() => {
	database = openMigratedDatabase();
});

afterEach(() => {
	database.close();
});

function seedGraph(): void {
	insertQuizSet(database, { id: "set-1" });
	insertQuestion(database, { id: "question-1", quizSetId: "set-1" });
	insertQuestionOption(database, {
		id: "option-1",
		questionId: "question-1",
	});
	insertQuizAttempt(database, { id: "attempt-1", quizSetId: "set-1" });
	insertQuestionResponse(database, {
		attemptId: "attempt-1",
		questionId: "question-1",
	});
}

describe("initial schema", () => {
	test("creates every application table plus the migration ledger", () => {
		const tables = database
			.query<{ name: string }, []>(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
			)
			.all()
			.map((row) => row.name);

		expect(tables).toEqual(["__drizzle_migrations", ...applicationTables]);
	});

	test("enforces foreign keys on the connection", () => {
		const [row] = database
			.query<{ foreign_keys: number }, []>("PRAGMA foreign_keys")
			.all();

		expect(row?.foreign_keys).toBe(1);
	});

	test("rejects a question whose quiz set does not exist", () => {
		expect(() =>
			insertQuestion(database, { id: "question-1", quizSetId: "missing" }),
		).toThrow(/FOREIGN KEY constraint failed/);
	});
});

describe("strict typing", () => {
	test.each([...applicationTables])("declares %s as STRICT", (table) => {
		expect(tableDefinition(database, table)).toMatch(/\)\s*STRICT$/);
	});

	test("rejects a BLOB in a TEXT column", () => {
		expect(() =>
			database.run(
				"INSERT INTO quiz_sets (id, title, language, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
				[
					"set-1",
					new Uint8Array([1, 2, 3]),
					"uk",
					"draft",
					"2026-08-01T00:00:00.000Z",
					"2026-08-01T00:00:00.000Z",
				],
			),
		).toThrow(/cannot store BLOB value in TEXT column/);
	});

	test("rejects a fractional value in an INTEGER column", () => {
		insertQuizSet(database, { id: "set-1" });

		expect(() =>
			insertQuizAttempt(database, {
				id: "attempt-1",
				quizSetId: "set-1",
				telegramUserId: 1.5,
			}),
		).toThrow(/cannot store REAL value in INTEGER column/);
	});
});

describe("primary keys", () => {
	test.each([
		[
			"quiz_sets",
			"INSERT INTO quiz_sets (id, title, language, status, created_at, updated_at) VALUES (NULL, 'Title', 'uk', 'draft', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')",
		],
		[
			"questions",
			"INSERT INTO questions (id, quiz_set_id, type, prompt, difficulty, position, fingerprint) VALUES (NULL, 'set-1', 'single_choice', 'Prompt', 'medium', 0, 'fingerprint')",
		],
		[
			"question_options",
			"INSERT INTO question_options (id, question_id, text, is_correct, position) VALUES (NULL, 'question-1', 'Option', 1, 0)",
		],
		[
			"quiz_attempts",
			"INSERT INTO quiz_attempts (id, quiz_set_id, telegram_user_id, mode, status, question_ids, started_at, updated_at) VALUES (NULL, 'set-1', 42, 'full', 'active', '[]', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')",
		],
	])("rejects a NULL primary key in %s", (_table, statement) => {
		seedGraph();

		expect(() => database.run(statement)).toThrow(/NOT NULL constraint failed/);
	});

	test.each([
		"attempt_id",
		"question_id",
	])("rejects a NULL %s in the question_responses composite key", (column) => {
		seedGraph();

		const values =
			column === "attempt_id"
				? ["NULL", "'question-1'"]
				: ["'attempt-1'", "NULL"];

		expect(() =>
			database.run(
				`INSERT INTO question_responses (attempt_id, question_id, selected_option_ids, is_correct, answered_at) VALUES (${values.join(", ")}, '[]', 1, '2026-08-01T00:00:00.000Z')`,
			),
		).toThrow(/NOT NULL constraint failed/);
	});

	test("rejects a second response for the same attempt and question", () => {
		seedGraph();

		expect(() =>
			insertQuestionResponse(database, {
				attemptId: "attempt-1",
				questionId: "question-1",
				isCorrect: 0,
			}),
		).toThrow(/UNIQUE constraint failed/);
	});
});

describe("enumerated columns", () => {
	test.each(
		Object.values(QuizSetStatus),
	)("accepts quiz_sets.status %s", (status) => {
		insertQuizSet(database, { id: `set-${status}`, status });

		expect(countRows(database, "quiz_sets")).toBe(1);
	});

	test("rejects an unknown quiz_sets.status", () => {
		expect(() =>
			insertQuizSet(database, { id: "set-1", status: "retired" }),
		).toThrow(/CHECK constraint failed/);
	});

	test.each(
		Object.values(QuestionType),
	)("accepts questions.type %s", (type) => {
		insertQuizSet(database, { id: "set-1" });
		insertQuestion(database, {
			id: "question-1",
			quizSetId: "set-1",
			type,
		});

		expect(countRows(database, "questions")).toBe(1);
	});

	test("rejects an unknown questions.type", () => {
		insertQuizSet(database, { id: "set-1" });

		expect(() =>
			insertQuestion(database, {
				id: "question-1",
				quizSetId: "set-1",
				type: "open_text",
			}),
		).toThrow(/CHECK constraint failed/);
	});

	test.each(
		Object.values(Difficulty),
	)("accepts questions.difficulty %s", (difficulty) => {
		insertQuizSet(database, { id: "set-1" });
		insertQuestion(database, {
			id: "question-1",
			quizSetId: "set-1",
			difficulty,
		});

		expect(countRows(database, "questions")).toBe(1);
	});

	test("rejects an unknown questions.difficulty", () => {
		insertQuizSet(database, { id: "set-1" });

		expect(() =>
			insertQuestion(database, {
				id: "question-1",
				quizSetId: "set-1",
				difficulty: "insane",
			}),
		).toThrow(/CHECK constraint failed/);
	});

	test.each(
		Object.values(QuizAttemptMode),
	)("accepts quiz_attempts.mode %s", (mode) => {
		insertQuizSet(database, { id: "set-1" });
		insertQuizAttempt(database, {
			id: "attempt-1",
			quizSetId: "set-1",
			mode,
		});

		expect(countRows(database, "quiz_attempts")).toBe(1);
	});

	test("rejects an unknown quiz_attempts.mode", () => {
		insertQuizSet(database, { id: "set-1" });

		expect(() =>
			insertQuizAttempt(database, {
				id: "attempt-1",
				quizSetId: "set-1",
				mode: "random",
			}),
		).toThrow(/CHECK constraint failed/);
	});

	test.each(
		Object.values(QuizAttemptStatus),
	)("accepts quiz_attempts.status %s", (status) => {
		insertQuizSet(database, { id: "set-1" });
		insertQuizAttempt(database, {
			id: "attempt-1",
			quizSetId: "set-1",
			status,
		});

		expect(countRows(database, "quiz_attempts")).toBe(1);
	});

	test("rejects an unknown quiz_attempts.status", () => {
		insertQuizSet(database, { id: "set-1" });

		expect(() =>
			insertQuizAttempt(database, {
				id: "attempt-1",
				quizSetId: "set-1",
				status: "abandoned",
			}),
		).toThrow(/CHECK constraint failed/);
	});

	test.each([0, 1])("accepts question_options.is_correct %p", (isCorrect) => {
		insertQuizSet(database, { id: "set-1" });
		insertQuestion(database, { id: "question-1", quizSetId: "set-1" });
		insertQuestionOption(database, {
			id: "option-1",
			questionId: "question-1",
			isCorrect,
		});

		expect(countRows(database, "question_options")).toBe(1);
	});

	test("rejects a question_options.is_correct outside 0 and 1", () => {
		insertQuizSet(database, { id: "set-1" });
		insertQuestion(database, { id: "question-1", quizSetId: "set-1" });

		expect(() =>
			insertQuestionOption(database, {
				id: "option-1",
				questionId: "question-1",
				isCorrect: 2,
			}),
		).toThrow(/CHECK constraint failed/);
	});

	test.each([0, 1])("accepts question_responses.is_correct %p", (isCorrect) => {
		seedGraph();
		insertQuizAttempt(database, { id: "attempt-2", quizSetId: "set-1" });
		insertQuestionResponse(database, {
			attemptId: "attempt-2",
			questionId: "question-1",
			isCorrect,
		});

		expect(countRows(database, "question_responses")).toBe(2);
	});

	test("rejects a question_responses.is_correct outside 0 and 1", () => {
		seedGraph();
		insertQuizAttempt(database, { id: "attempt-2", quizSetId: "set-1" });

		expect(() =>
			insertQuestionResponse(database, {
				attemptId: "attempt-2",
				questionId: "question-1",
				isCorrect: 2,
			}),
		).toThrow(/CHECK constraint failed/);
	});
});

describe("unique constraints", () => {
	test("rejects two questions at the same position in one quiz set", () => {
		insertQuizSet(database, { id: "set-1" });
		insertQuestion(database, { id: "question-1", quizSetId: "set-1" });

		expect(() =>
			insertQuestion(database, { id: "question-2", quizSetId: "set-1" }),
		).toThrow(/UNIQUE constraint failed/);
	});

	test("rejects two questions with the same fingerprint in one quiz set", () => {
		insertQuizSet(database, { id: "set-1" });
		insertQuestion(database, {
			id: "question-1",
			quizSetId: "set-1",
			fingerprint: "shared",
		});

		expect(() =>
			insertQuestion(database, {
				id: "question-2",
				quizSetId: "set-1",
				position: 1,
				fingerprint: "shared",
			}),
		).toThrow(/UNIQUE constraint failed/);
	});

	test("allows the same fingerprint in a different quiz set", () => {
		insertQuizSet(database, { id: "set-1" });
		insertQuizSet(database, { id: "set-2" });
		insertQuestion(database, {
			id: "question-1",
			quizSetId: "set-1",
			fingerprint: "shared",
		});
		insertQuestion(database, {
			id: "question-2",
			quizSetId: "set-2",
			fingerprint: "shared",
		});

		expect(countRows(database, "questions")).toBe(2);
	});

	test("rejects two options at the same position in one question", () => {
		insertQuizSet(database, { id: "set-1" });
		insertQuestion(database, { id: "question-1", quizSetId: "set-1" });
		insertQuestionOption(database, {
			id: "option-1",
			questionId: "question-1",
		});

		expect(() =>
			insertQuestionOption(database, {
				id: "option-2",
				questionId: "question-1",
			}),
		).toThrow(/UNIQUE constraint failed/);
	});
});

describe("defaults", () => {
	test("stores an empty JSON array when tags are omitted", () => {
		insertQuizSet(database, { id: "set-1" });

		const [row] = database
			.query<{ tags: string }, []>("SELECT tags FROM quiz_sets")
			.all();

		expect(row?.tags).toBe("[]");
	});
});

describe("cascading deletes", () => {
	test("deleting a quiz set removes its whole graph", () => {
		seedGraph();

		database.run("DELETE FROM quiz_sets WHERE id = 'set-1'");

		expect(countRows(database, "questions")).toBe(0);
		expect(countRows(database, "question_options")).toBe(0);
		expect(countRows(database, "quiz_attempts")).toBe(0);
		expect(countRows(database, "question_responses")).toBe(0);
	});

	test("deleting a question removes its options and responses", () => {
		seedGraph();

		database.run("DELETE FROM questions WHERE id = 'question-1'");

		expect(countRows(database, "quiz_sets")).toBe(1);
		expect(countRows(database, "quiz_attempts")).toBe(1);
		expect(countRows(database, "question_options")).toBe(0);
		expect(countRows(database, "question_responses")).toBe(0);
	});
});
