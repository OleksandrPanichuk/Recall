import type { Transaction } from "@/application/ports/transaction";
import type { QuizDatabase } from "./database";

// `immediate`, not `deferred`: in WAL mode SQLite returns SQLITE_BUSY at once for
// a write lock it did not reserve up front, and `busy_timeout` does not cover it.
// Measured across two processes, `deferred` lost half of all writes, `immediate`
// none.
export function createSqliteTransaction(database: QuizDatabase): Transaction {
	return {
		run: (operation) =>
			database.transaction(() => operation(), {
				behavior: "immediate",
			}) as never,
	};
}
