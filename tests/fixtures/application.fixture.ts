import type { Database } from "bun:sqlite";
import { createSqliteQuizAttemptRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-attempt.repository";
import { createSqliteQuizSetRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-set.repository";
import { createSqliteReviewRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-review.repository";
import { createSqliteTransaction } from "@/adapters/persistence/sqlite/sqlite-transaction";
import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { ReviewRepository } from "@/application/ports/repositories/review.repository";
import type { Transaction } from "@/application/ports/transaction";
import { openMigratedDatabase } from "../integration/sqlite/migrated-database";

export const DEFAULT_START_AT = new Date("2026-08-01T10:00:00.000Z");

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
	readonly clock: MutableClock;
	readonly idGenerator: IdGenerator;
	readonly transaction: Transaction;
	readonly quizSets: QuizSetRepository;
	readonly attempts: QuizAttemptRepository;
	readonly reviews: ReviewRepository;
	close(): void;
}

export function createTestContext(startAt = DEFAULT_START_AT): TestContext {
	const database = openMigratedDatabase();
	const transaction = createSqliteTransaction(database);

	return {
		database,
		clock: createMutableClock(startAt),
		idGenerator: createSequentialIdGenerator(),
		transaction,
		quizSets: createSqliteQuizSetRepository(database, transaction),
		attempts: createSqliteQuizAttemptRepository(database, transaction),
		reviews: createSqliteReviewRepository(database, transaction),
		close: () => {
			database.close();
		},
	};
}
