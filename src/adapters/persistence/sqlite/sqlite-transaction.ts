import type { Database } from "bun:sqlite";
import type { Transaction } from "@/application/ports/transaction";

export function createSqliteTransaction(database: Database): Transaction {
	return {
		run: (operation) => database.transaction(operation)(),
	};
}
