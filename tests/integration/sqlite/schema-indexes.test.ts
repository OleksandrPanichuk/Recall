import type { Database, SQLQueryBindings } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	applicationTables,
	insertQuestion,
	insertQuestionResponse,
	insertQuizAttempt,
	insertQuizSet,
	insertReviewItem,
	openMigratedDatabase,
} from "./migrated-database";

let database: Database;

beforeEach(() => {
	database = openMigratedDatabase();
	insertQuizSet(database, { id: "set-1", status: "published" });
	insertQuestion(database, { id: "question-1", quizSetId: "set-1" });
	insertQuestion(database, {
		id: "question-2",
		quizSetId: "set-1",
		position: 1,
	});
	insertQuizAttempt(database, { id: "attempt-1", quizSetId: "set-1" });
	insertQuestionResponse(database, {
		attemptId: "attempt-1",
		questionId: "question-1",
	});
	insertReviewItem(database, { id: "review-1", questionId: "question-1" });
});

afterEach(() => {
	database.close();
});

interface IndexColumnRow {
	readonly index_name: string;
	readonly is_unique: number;
	readonly column_name: string;
}

function declaredIndexes(unique: boolean): Record<string, readonly string[]> {
	const rows = applicationTables.flatMap((table) =>
		database
			.query<IndexColumnRow, [string]>(
				`SELECT il.name AS index_name, il."unique" AS is_unique, ii.name AS column_name
				 FROM pragma_index_list(?) AS il
				 JOIN pragma_index_info(il.name) AS ii
				 WHERE il.name NOT LIKE 'sqlite_%'
				 ORDER BY il.name, ii.seqno`,
			)
			.all(table),
	);

	const grouped: Record<string, string[]> = {};

	for (const row of rows) {
		if (Boolean(row.is_unique) !== unique) {
			continue;
		}

		const columns = grouped[row.index_name];

		if (columns) {
			columns.push(row.column_name);
		} else {
			grouped[row.index_name] = [row.column_name];
		}
	}

	return grouped;
}

function queryPlan(
	statement: string,
	parameters: readonly SQLQueryBindings[],
): string {
	return database
		.query<{ detail: string }, SQLQueryBindings[]>(
			`EXPLAIN QUERY PLAN ${statement}`,
		)
		.all(...parameters)
		.map((row) => row.detail)
		.join("\n");
}

describe("index set", () => {
	test("declares exactly the measured non-unique indexes", () => {
		expect(declaredIndexes(false)).toEqual({
			idx_question_responses_question: ["question_id"],
			idx_quiz_attempts_user_status: ["telegram_user_id", "status"],
			idx_quiz_sets_status: ["status", "updated_at"],
			idx_review_items_due: ["telegram_user_id", "due_at"],
			idx_review_items_question: ["question_id"],
		});
	});

	test("declares exactly the unique constraints", () => {
		expect(declaredIndexes(true)).toEqual({
			question_options_question_id_position_unique: ["question_id", "position"],
			questions_quiz_set_id_fingerprint_unique: ["quiz_set_id", "fingerprint"],
			questions_quiz_set_id_position_unique: ["quiz_set_id", "position"],
			review_items_telegram_user_id_question_id_unique: [
				"telegram_user_id",
				"question_id",
			],
		});
	});
});

describe("query plans", () => {
	test("lists quiz sets by status ordered by recency without a temp b-tree", () => {
		const plan = queryPlan(
			"SELECT id FROM quiz_sets WHERE status = ? ORDER BY updated_at DESC",
			["published"],
		);

		expect(plan).toContain("USING INDEX idx_quiz_sets_status");
		expect(plan).not.toContain("TEMP B-TREE");
		expect(plan).not.toContain("SCAN quiz_sets");
	});

	test("finds the active or paused attempt for a user through its index", () => {
		const plan = queryPlan(
			"SELECT id FROM quiz_attempts WHERE telegram_user_id = ? AND status IN (?, ?) ORDER BY updated_at DESC LIMIT 1",
			[42, "active", "paused"],
		);

		expect(plan).toContain("USING INDEX idx_quiz_attempts_user_status");
		expect(plan).not.toContain("SCAN quiz_attempts");
	});

	test("lists due review items ordered by due date without a temp b-tree", () => {
		const plan = queryPlan(
			"SELECT id FROM review_items WHERE telegram_user_id = ? AND due_at <= ? AND state <> ? ORDER BY due_at ASC LIMIT ?",
			[42, "2026-09-01T00:00:00.000Z", "retired", 10],
		);

		expect(plan).toContain("USING INDEX idx_review_items_due");
		expect(plan).not.toContain("TEMP B-TREE");
		expect(plan).not.toContain("SCAN review_items");
	});

	test("reads the questions of a set in position order without scanning or sorting", () => {
		const plan = queryPlan(
			"SELECT id FROM questions WHERE quiz_set_id = ? ORDER BY position",
			["set-1"],
		);

		expect(plan).toContain("SEARCH questions");
		expect(plan).not.toContain("TEMP B-TREE");
		expect(plan).not.toContain("SCAN questions");
	});
});
