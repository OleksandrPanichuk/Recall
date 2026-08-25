import type { OwnerId } from "@/application/ports/owner";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import { createMemoryAttemptRepository } from "./attempt.repository";
import { createMemoryPageRepository } from "./page.repository";
import { createMemoryQuizRepository } from "./quiz.repository";
import { createMemoryReviewRepository } from "./review.repository";
import { emptyStore, type MemoryStore, restoreInto, snapshotOf } from "./store";
import { createMemoryTermPairRepository } from "./term-pair.repository";

export interface MemoryPersistence {
	readonly store: MemoryStore;
	readonly unitOfWork: UnitOfWork<RepositoryScope>;
	readonly scope: RepositoryScope;
}

// Postgres isolates owners with a column; the double isolates them with a store
// each, which cannot leak by a forgotten predicate.
export interface MemoryStores {
	of(owner: OwnerId): MemoryStore;
	owners(): readonly OwnerId[];
}

export function createMemoryStores(): MemoryStores {
	const stores = new Map<string, MemoryStore>();

	return {
		of: (owner) => {
			const existing = stores.get(owner);

			if (existing !== undefined) {
				return existing;
			}

			const created = emptyStore();

			stores.set(owner, created);

			return created;
		},
		owners: () => [...stores.keys()] as OwnerId[],
	};
}

// The snapshot is what makes this a usable double rather than a fake: an
// operation that throws must leave nothing behind, exactly as Postgres does.
export function createMemoryPersistence(store: MemoryStore): MemoryPersistence {
	const scope: RepositoryScope = {
		pages: createMemoryPageRepository(store),
		quizzes: createMemoryQuizRepository(store),
		attempts: createMemoryAttemptRepository(store),
		reviews: createMemoryReviewRepository(store),
		termPairs: createMemoryTermPairRepository(store),
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
