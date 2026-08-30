import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = join(import.meta.dir, "..", "..", "drizzle");

const AT = "2026-08-01T10:00:00.000Z";

export interface LegacyFixture {
	readonly quizSetId: string;
	readonly questionIds: readonly string[];
	readonly termPairId: string;
}

export function createLegacyDatabase(path: string): Database {
	const database = new Database(path, { create: true });

	database.run("PRAGMA foreign_keys = ON");

	for (const name of readdirSync(MIGRATIONS)
		.filter((entry) => entry.endsWith(".sql"))
		.sort()) {
		for (const statement of readFileSync(join(MIGRATIONS, name), "utf8")
			.split("--> statement-breakpoint")
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0)) {
			database.run(statement);
		}
	}

	return database;
}

export function seedLegacyDatabase(path: string): LegacyFixture {
	const database = createLegacyDatabase(path);
	const quizSetId = "set-ddia";
	const termPairId = "pair-shard";
	const questionIds = [
		"question-replication",
		"question-lsm",
		"question-shard-forward",
		"question-shard-back",
	];

	try {
		database.run(
			"insert into folders (id, name, parent_id, created_at, updated_at) values (?, ?, null, ?, ?)",
			["folder-programming", "Programming", AT, AT],
		);
		database.run(
			"insert into folders (id, name, parent_id, created_at, updated_at) values (?, ?, ?, ?, ?)",
			["folder-books", "Books", "folder-programming", AT, AT],
		);

		database.run(
			`insert into quiz_sets (
				id, title, description, language, source, source_chapters, tags,
				status, created_at, updated_at, published_at, archived_at, folder_id
			) values (?, ?, null, ?, null, null, ?, 'published', ?, ?, ?, null, ?)`,
			[
				quizSetId,
				"Designing Data-Intensive Applications",
				"en",
				JSON.stringify(["systems", "storage"]),
				AT,
				AT,
				AT,
				"folder-books",
			],
		);

		database.run(
			`insert into vocabulary_items (
				id, quiz_set_id, terms, translations, transcription, example, topic,
				created_at, updated_at
			) values (?, ?, ?, ?, null, null, ?, ?, ?)`,
			[
				termPairId,
				quizSetId,
				JSON.stringify(["shard"]),
				JSON.stringify(["шард"]),
				"partitioning",
				AT,
				AT,
			],
		);

		const questions: readonly [
			string,
			string,
			string,
			string | null,
			number,
			string | null,
		][] = [
			[
				"question-replication",
				"single_choice",
				"What does replication buy?",
				"replication",
				0,
				null,
			],
			[
				"question-lsm",
				"true_false",
				"An LSM tree writes in place.",
				null,
				1,
				null,
			],
			[
				"question-shard-forward",
				"single_choice",
				"shard",
				"partitioning",
				2,
				termPairId,
			],
			[
				"question-shard-back",
				"single_choice",
				"шард",
				"partitioning",
				3,
				termPairId,
			],
		];

		for (const [id, type, prompt, topic, position, pairId] of questions) {
			database.run(
				`insert into questions (
					id, quiz_set_id, type, prompt, explanation, source_reference, topic,
					difficulty, hint, position, fingerprint, vocabulary_item_id
				) values (?, ?, ?, ?, null, null, ?, 'medium', null, ?, ?, ?)`,
				[
					id,
					quizSetId,
					type,
					prompt,
					topic,
					position,
					`fingerprint-${id}`,
					pairId,
				],
			);

			database.run(
				`insert into question_options (id, question_id, text, is_correct, position, match_key)
				 values (?, ?, ?, 1, 0, null)`,
				[`${id}-right`, id, `Right for ${prompt}`],
			);
			database.run(
				`insert into question_options (id, question_id, text, is_correct, position, match_key)
				 values (?, ?, ?, 0, 1, null)`,
				[`${id}-wrong`, id, `Wrong for ${prompt}`],
			);
		}

		database.run(
			`insert into quiz_attempts (
				id, quiz_set_id, telegram_user_id, mode, status, question_ids,
				started_at, updated_at, completed_at
			) values (?, ?, 7, 'full', 'completed', ?, ?, ?, ?)`,
			[
				"attempt-one",
				quizSetId,
				JSON.stringify([...questionIds, "question-deleted-long-ago"]),
				AT,
				AT,
				AT,
			],
		);

		database.run(
			`insert into question_responses (
				attempt_id, question_id, selected_option_ids, is_correct, answered_at,
				typed_answer, skipped, credit_earned, credit_possible
			) values (?, ?, ?, 1, ?, null, 0, 1, 1)`,
			[
				"attempt-one",
				"question-replication",
				JSON.stringify(["question-replication-right"]),
				AT,
			],
		);

		database.run(
			`insert into question_repetition_schedules (
				question_id, telegram_user_id, repetition_count, lapses,
				last_completed_at, due_at, created_at, updated_at
			) values (?, 7, 1, 0, ?, ?, ?, ?)`,
			["question-replication", AT, AT, AT, AT],
		);

		database.run(
			`insert into repetition_defaults (
				id, intervals_days, max_interval_days, max_repetitions, updated_at,
				shuffle_options, shuffle_questions, exam_mode
			) values (1, ?, 180, 5, ?, 0, 0, 0)`,
			[JSON.stringify([1, 3, 7]), AT],
		);

		database.run(
			`insert into repetition_settings (
				quiz_set_id, intervals_days, max_interval_days, max_repetitions,
				updated_at, shuffle_options, shuffle_questions, exam_mode
			) values (?, ?, 90, 4, ?, 1, 1, 0)`,
			[quizSetId, JSON.stringify([2, 5, 9]), AT],
		);
	} finally {
		database.close();
	}

	return { quizSetId, questionIds, termPairId };
}
