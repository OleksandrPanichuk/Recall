import { Database } from "bun:sqlite";
import { applyMigrations } from "@/adapters/persistence/sqlite/migrator";

// The OAuth store is the one thing still on SQLite: MCP client credentials are
// replaced by Better Auth in phase 7.
export function openMigratedDatabase(path = ":memory:"): Database {
	const database = new Database(path, { create: true });

	database.run("PRAGMA foreign_keys = ON");
	applyMigrations(database);

	return database;
}
