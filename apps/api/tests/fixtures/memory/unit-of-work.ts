import { AsyncLocalStorage } from "node:async_hooks";
import type { RepositoryScope } from "@tests/fixtures/repository-scope";
import type { UnitOfWork } from "@tests/fixtures/unit-of-work";
import type { OwnerId } from "@/core/owner";
import { Transaction } from "@/core/transaction";
import { createMemoryAnalyticsRepository } from "./analytics.repository";
import { createMemoryAttachmentRepository } from "./attachment.repository";
import { createMemoryAttemptRepository } from "./attempt.repository";
import { createMemoryPageRepository } from "./page.repository";
import { createMemoryQuizRepository } from "./quiz.repository";
import { createMemoryReviewRepository } from "./review.repository";
import { emptyStore, type MemoryStore, restoreInto, snapshotOf } from "./store";
import { createMemoryTermPairRepository } from "./term-pair.repository";

class StoreLock {
	private readonly holder = new AsyncLocalStorage<StoreLock>();
	private tail: Promise<void> = Promise.resolve();

	get held(): boolean {
		return this.holder.getStore() === this;
	}

	async run<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
		if (this.held) {
			return operation();
		}

		const previous = this.tail;
		let release: () => void = () => {};

		this.tail = new Promise<void>((resolve) => {
			release = resolve;
		});

		await previous;

		try {
			return await this.holder.run(this, operation);
		} finally {
			release();
		}
	}
}

const locks = new WeakMap<MemoryStore, StoreLock>();

const lockOf = (store: MemoryStore): StoreLock => {
	const existing = locks.get(store);

	if (existing !== undefined) {
		return existing;
	}

	const created = new StoreLock();

	locks.set(store, created);

	return created;
};

export class MemoryTransaction extends Transaction {
	constructor(private readonly store: MemoryStore) {
		super();
	}

	run<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
		const lock = lockOf(this.store);

		if (lock.held) {
			return operation();
		}

		return lock.run(async () => {
			const snapshot = snapshotOf(this.store);

			try {
				return await operation();
			} catch (error) {
				restoreInto(this.store, snapshot);

				throw error;
			}
		});
	}
}

export interface MemoryPersistence {
	readonly store: MemoryStore;
	readonly unitOfWork: UnitOfWork<RepositoryScope>;
	readonly scope: RepositoryScope;
	readonly transaction: Transaction;
}

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

export function createMemoryPersistence(store: MemoryStore): MemoryPersistence {
	const scope: RepositoryScope = {
		pages: createMemoryPageRepository(store),
		quizzes: createMemoryQuizRepository(store),
		attempts: createMemoryAttemptRepository(store),
		reviews: createMemoryReviewRepository(store),
		termPairs: createMemoryTermPairRepository(store),
		analytics: createMemoryAnalyticsRepository(store),
		attachments: createMemoryAttachmentRepository(store),
	};

	return {
		store,
		scope,
		transaction: new MemoryTransaction(store),
		unitOfWork: {
			run: (operation) =>
				lockOf(store).run(async () => {
					const snapshot = snapshotOf(store);

					try {
						return await operation(scope);
					} catch (error) {
						restoreInto(store, snapshot);

						throw error;
					}
				}),
		},
	};
}
