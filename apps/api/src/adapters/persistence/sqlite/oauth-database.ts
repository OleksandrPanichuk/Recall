import type { Database } from "bun:sqlite";
import type { Transaction } from "@/application/ports/transaction";
import {
	createDatabase,
	createDrizzleClient,
	type QuizDatabase,
} from "./database";
import { applyMigrations } from "./migrator";
import { createSqliteTransaction } from "./sqlite-transaction";

export interface OAuthDatabase {
	readonly database: Database;
	readonly client: QuizDatabase;
	readonly transaction: Transaction;
	close(): void;
}

// MCP client credentials keep their own SQLite file. They are not quiz data, they
// are replaced by Better Auth in phase 7, and keeping them here lets the quiz
// data move to Postgres without dragging the OAuth provider along.
export function createOAuthDatabase(path: string): OAuthDatabase {
	const database = createDatabase({ path });

	applyMigrations(database);

	const client = createDrizzleClient(database);

	return {
		database,
		client,
		transaction: createSqliteTransaction(client),
		close: () => {
			database.close();
		},
	};
}
