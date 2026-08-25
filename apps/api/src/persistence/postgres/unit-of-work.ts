import type { OwnerId } from "@/application/ports/owner";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type { RecallDatabase } from "./client";
import { createAttemptPostgresRepository } from "./repositories/attempt.repository";
import { createPagePostgresRepository } from "./repositories/page.repository";
import { createQuizPostgresRepository } from "./repositories/quiz.repository";
import { createReviewPostgresRepository } from "./repositories/review.repository";
import { createTermPairPostgresRepository } from "./repositories/term-pair.repository";

export type Executor =
	| RecallDatabase
	| Parameters<Parameters<RecallDatabase["transaction"]>[0]>[0];

// Every repository is built against one owner. A use case cannot reach another
// owner's rows because it never holds anything that could name them.
export const scopeFor = (
	executor: Executor,
	owner: OwnerId,
): RepositoryScope => ({
	pages: createPagePostgresRepository(executor, owner),
	quizzes: createQuizPostgresRepository(executor, owner),
	attempts: createAttemptPostgresRepository(executor, owner),
	reviews: createReviewPostgresRepository(executor, owner),
	termPairs: createTermPairPostgresRepository(executor, owner),
});

export function createPostgresUnitOfWork(
	db: RecallDatabase,
	owner: OwnerId,
): UnitOfWork<RepositoryScope> {
	return {
		run: (operation) => db.transaction((tx) => operation(scopeFor(tx, owner))),
	};
}

export const readOnlyScope = (
	db: RecallDatabase,
	owner: OwnerId,
): RepositoryScope => scopeFor(db, owner);
