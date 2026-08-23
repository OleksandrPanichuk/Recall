import type { ContentScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type { RecallDatabase } from "./client";
import { createPagePostgresRepository } from "./repositories/page.repository";
import { createQuizPostgresRepository } from "./repositories/quiz.repository";

export type Executor =
	| RecallDatabase
	| Parameters<Parameters<RecallDatabase["transaction"]>[0]>[0];

export const scopeFor = (executor: Executor): ContentScope => ({
	pages: createPagePostgresRepository(executor),
	quizzes: createQuizPostgresRepository(executor),
});

export function createPostgresUnitOfWork(
	db: RecallDatabase,
): UnitOfWork<ContentScope> {
	return {
		run: (operation) => db.transaction((tx) => operation(scopeFor(tx))),
	};
}

export const readOnlyScope = (db: RecallDatabase): ContentScope => scopeFor(db);
