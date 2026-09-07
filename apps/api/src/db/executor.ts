import { AsyncLocalStorage } from "node:async_hooks";
import { Transaction } from "@/core/transaction";
import type { RecallDatabase } from "./client";

type TransactionCallback = Parameters<RecallDatabase["transaction"]>[0];

export type PostgresTransactionScope = Parameters<TransactionCallback>[0];

export type Executor = RecallDatabase | PostgresTransactionScope;

const storage = new AsyncLocalStorage<PostgresTransactionScope>();

export const executorFor = (db: RecallDatabase): Executor =>
	storage.getStore() ?? db;

export const inTransaction = (): boolean => storage.getStore() !== undefined;

export class PostgresTransaction extends Transaction {
	constructor(private readonly db: RecallDatabase) {
		super();
	}

	run<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
		if (storage.getStore() !== undefined) {
			return operation();
		}

		return this.db.transaction((scope) => storage.run(scope, operation));
	}
}
