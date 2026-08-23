import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type { RecallDatabase } from "./client";
import { createAttemptPostgresRepository } from "./repositories/attempt.repository";
import { createPagePostgresRepository } from "./repositories/page.repository";
import { createQuizPostgresRepository } from "./repositories/quiz.repository";

export type Executor =
	| RecallDatabase
	| Parameters<Parameters<RecallDatabase["transaction"]>[0]>[0];

export const scopeFor = (executor: Executor): RepositoryScope => ({
	pages: createPagePostgresRepository(executor),
	quizzes: createQuizPostgresRepository(executor),
	attempts: createAttemptPostgresRepository(executor),
});

export function createPostgresUnitOfWork(
	db: RecallDatabase,
): UnitOfWork<RepositoryScope> {
	return {
		run: (operation) => db.transaction((tx) => operation(scopeFor(tx))),
	};
}

export const readOnlyScope = (db: RecallDatabase): RepositoryScope =>
	scopeFor(db);
