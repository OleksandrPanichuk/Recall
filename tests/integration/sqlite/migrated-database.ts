import type { Database } from "bun:sqlite";
import { createDatabase } from "@/adapters/persistence/sqlite/database";
import { applyMigrations } from "@/adapters/persistence/sqlite/migrator";

export const applicationTables = [
	"folders",
	"oauth_clients",
	"oauth_codes",
	"oauth_tokens",
	"question_options",
	"question_repetition_schedules",
	"question_responses",
	"questions",
	"quiz_attempts",
	"quiz_sets",
	"repetition_defaults",
	"repetition_settings",
	"vocabulary_items",
] as const;

export function openMigratedDatabase(path = ":memory:"): Database {
	const database = createDatabase({ path });

	applyMigrations(database);

	return database;
}

export function insertQuizSet(
	database: Database,
	row: {
		readonly id: string;
		readonly status?: string;
		readonly updatedAt?: string;
	},
): void {
	database.run(
		"INSERT INTO quiz_sets (id, title, language, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		[
			row.id,
			`Quiz set ${row.id}`,
			"uk",
			row.status ?? "draft",
			"2026-08-01T00:00:00.000Z",
			row.updatedAt ?? "2026-08-01T00:00:00.000Z",
		],
	);
}

export function insertQuestion(
	database: Database,
	row: {
		readonly id: string;
		readonly quizSetId: string;
		readonly position?: number;
		readonly fingerprint?: string;
		readonly type?: string;
		readonly difficulty?: string;
		readonly topic?: string | null;
	},
): void {
	database.run(
		"INSERT INTO questions (id, quiz_set_id, type, prompt, topic, difficulty, position, fingerprint) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		[
			row.id,
			row.quizSetId,
			row.type ?? "single_choice",
			`Prompt ${row.id}`,
			row.topic ?? null,
			row.difficulty ?? "medium",
			row.position ?? 0,
			row.fingerprint ?? `fingerprint-${row.id}`,
		],
	);
}

export function insertQuestionOption(
	database: Database,
	row: {
		readonly id: string;
		readonly questionId: string;
		readonly position?: number;
		readonly isCorrect?: number;
	},
): void {
	database.run(
		"INSERT INTO question_options (id, question_id, text, is_correct, position) VALUES (?, ?, ?, ?, ?)",
		[
			row.id,
			row.questionId,
			`Option ${row.id}`,
			row.isCorrect ?? 1,
			row.position ?? 0,
		],
	);
}

export function insertQuizAttempt(
	database: Database,
	row: {
		readonly id: string;
		readonly quizSetId: string;
		readonly telegramUserId?: number;
		readonly mode?: string;
		readonly status?: string;
		readonly updatedAt?: string;
	},
): void {
	database.run(
		"INSERT INTO quiz_attempts (id, quiz_set_id, telegram_user_id, mode, status, question_ids, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		[
			row.id,
			row.quizSetId,
			row.telegramUserId ?? 42,
			row.mode ?? "full",
			row.status ?? "active",
			"[]",
			"2026-08-01T00:00:00.000Z",
			row.updatedAt ?? "2026-08-01T00:00:00.000Z",
		],
	);
}

export function insertQuestionResponse(
	database: Database,
	row: {
		readonly attemptId: string;
		readonly questionId: string;
		readonly isCorrect?: number;
	},
): void {
	database.run(
		"INSERT INTO question_responses (attempt_id, question_id, selected_option_ids, is_correct, answered_at) VALUES (?, ?, ?, ?, ?)",
		[
			row.attemptId,
			row.questionId,
			"[]",
			row.isCorrect ?? 1,
			"2026-08-01T00:00:00.000Z",
		],
	);
}

export function tableDefinition(database: Database, table: string): string {
	const [row] = database
		.query<{ sql: string }, [string]>(
			"SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
		)
		.all(table);

	if (!row) {
		throw new Error(`Table ${table} does not exist`);
	}

	return row.sql;
}

export function countRows(database: Database, table: string): number {
	const [row] = database
		.query<{ total: number }, []>(`SELECT count(*) AS total FROM ${table}`)
		.all();

	return row?.total ?? 0;
}
