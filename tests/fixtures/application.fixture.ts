import type { Database } from "bun:sqlite";
import type { QuizDatabase } from "@/adapters/persistence/sqlite/database";
import { createDrizzleClient } from "@/adapters/persistence/sqlite/database";
import { createSqliteFolderRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-folder.repository";
import { createSqliteQuizAttemptRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-attempt.repository";
import { createSqliteQuizSetRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-set.repository";
import { createSqliteRepetitionRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-repetition.repository";
import { createSqliteVocabularyRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-vocabulary.repository";
import { createSqliteTransaction } from "@/adapters/persistence/sqlite/sqlite-transaction";
import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { FolderRepository } from "@/application/ports/repositories/folder.repository";
import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import type { VocabularyRepository } from "@/application/ports/repositories/vocabulary.repository";
import type { Transaction } from "@/application/ports/transaction";
import { openMigratedDatabase } from "../integration/sqlite/migrated-database";

export const DEFAULT_START_AT = new Date("2026-08-01T10:00:00.000Z");
export const DEFAULT_TIMEZONE = "Europe/Kyiv";

export interface MutableClock extends Clock {
	set(at: Date): void;
	advance(milliseconds: number): void;
}

export function createMutableClock(startAt = DEFAULT_START_AT): MutableClock {
	let current = new Date(startAt.getTime());

	return {
		now: () => new Date(current.getTime()),
		set: (at) => {
			current = new Date(at.getTime());
		},
		advance: (milliseconds) => {
			current = new Date(current.getTime() + milliseconds);
		},
	};
}

export function createRealisticIdGenerator(prefix = "q"): IdGenerator {
	let next = 0;

	return {
		generate: () => {
			next += 1;

			return `${prefix}${String(next).padStart(17 - prefix.length + 1, "0")}`.slice(
				0,
				18,
			);
		},
	};
}

export function createSequentialIdGenerator(prefix = "id"): IdGenerator {
	let next = 0;

	return {
		generate: () => {
			next += 1;

			return `${prefix}-${next}`;
		},
	};
}

export interface TestContext {
	readonly database: Database;
	readonly client: QuizDatabase;
	readonly clock: MutableClock;
	readonly idGenerator: IdGenerator;
	readonly transaction: Transaction;
	readonly quizSets: QuizSetRepository;
	readonly folders: FolderRepository;
	readonly attempts: QuizAttemptRepository;
	readonly repetition: RepetitionRepository;
	readonly vocabulary: VocabularyRepository;
	readonly timezone: string;
	close(): void;
}

export function createTestContext(startAt = DEFAULT_START_AT): TestContext {
	const database = openMigratedDatabase();
	const client = createDrizzleClient(database);
	const transaction = createSqliteTransaction(client);
	const clock = createMutableClock(startAt);

	return {
		database,
		client,
		clock,
		idGenerator: createSequentialIdGenerator(),
		transaction,
		quizSets: createSqliteQuizSetRepository(client, transaction),
		folders: createSqliteFolderRepository(client, transaction),
		attempts: createSqliteQuizAttemptRepository(client, transaction),
		repetition: createSqliteRepetitionRepository(client, transaction, () =>
			clock.now(),
		),
		vocabulary: createSqliteVocabularyRepository(client, transaction),
		timezone: DEFAULT_TIMEZONE,
		close: () => {
			database.close();
		},
	};
}
