import type { Transaction } from "@/application/ports/transaction";
import type { QuizDatabase } from "./database";

/**
 * Every write here reads first and writes second — load the aggregate, apply a
 * domain transition, save it. Under the default `BEGIN` that takes a read lock
 * and then tries to upgrade, and in WAL mode SQLite refuses to *wait* for a write
 * lock it did not reserve up front: it returns SQLITE_BUSY immediately, because
 * waiting could deadlock two readers both wanting to upgrade. `busy_timeout` does
 * not apply to that case.
 *
 * That matters because the bot and the MCP server are meant to run at the same
 * time against one file. Measured with two processes doing this exact
 * read-then-write shape: `deferred` lost half of all writes to "database is
 * locked", `immediate` lost none.
 *
 * Repositories issue their statements through the same Drizzle client rather than
 * the `tx` handle, which works because `bun:sqlite` is a single connection — the
 * BEGIN and COMMIT this opens apply to every statement on it.
 */
export function createSqliteTransaction(database: QuizDatabase): Transaction {
	return {
		run: (operation) =>
			database.transaction(() => operation(), {
				behavior: "immediate",
			}) as never,
	};
}
