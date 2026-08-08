import type { Transaction } from "@/application/ports/transaction";
import type { QuizDatabase } from "./database";

/**
 * Repositories issue their statements through the same Drizzle client rather
 * than the `tx` handle, which works because `bun:sqlite` is a single connection:
 * the BEGIN and COMMIT this opens apply to every statement on it.
 */
export function createSqliteTransaction(database: QuizDatabase): Transaction {
	return {
		run: (operation) => database.transaction(() => operation()) as never,
	};
}
