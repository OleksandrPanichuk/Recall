import type { ContentScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import { createMemoryPageRepository } from "./page.repository";
import { createMemoryQuizRepository } from "./quiz.repository";
import { type MemoryStore, restoreInto, snapshotOf } from "./store";

export interface MemoryPersistence {
	readonly store: MemoryStore;
	readonly unitOfWork: UnitOfWork<ContentScope>;
	readonly scope: ContentScope;
}

// The snapshot is what makes this a usable double rather than a fake: an
// operation that throws must leave nothing behind, exactly as Postgres does.
export function createMemoryPersistence(store: MemoryStore): MemoryPersistence {
	const scope: ContentScope = {
		pages: createMemoryPageRepository(store),
		quizzes: createMemoryQuizRepository(store),
	};

	return {
		store,
		scope,
		unitOfWork: {
			run: async (operation) => {
				const snapshot = snapshotOf(store);

				try {
					return await operation(scope);
				} catch (error) {
					restoreInto(store, snapshot);

					throw error;
				}
			},
		},
	};
}
