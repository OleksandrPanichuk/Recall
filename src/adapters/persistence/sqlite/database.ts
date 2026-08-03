import { Database } from "bun:sqlite";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

export interface DatabaseOptions {
	readonly path: string;
}

export type QuizDatabase = BunSQLiteDatabase<typeof schema>;

const busyTimeoutMs = 5000;
const walSwitchRetryDelayMs = 25;
const walSwitchAttempts = Math.ceil(busyTimeoutMs / walSwitchRetryDelayMs);

function isBusy(error: unknown): boolean {
	return (
		error instanceof Error &&
		"code" in error &&
		typeof error.code === "string" &&
		error.code.startsWith("SQLITE_BUSY")
	);
}

function journalMode(database: Database): string {
	const [row] = database
		.query<{ journal_mode: string }, []>("PRAGMA journal_mode")
		.all();

	return row?.journal_mode ?? "";
}

function enableWriteAheadLog(database: Database): void {
	for (let attempt = 0; attempt < walSwitchAttempts; attempt += 1) {
		if (journalMode(database) === "wal") {
			return;
		}

		try {
			database.run("PRAGMA journal_mode = WAL");
			return;
		} catch (error) {
			if (!isBusy(error)) {
				throw error;
			}

			Bun.sleepSync(walSwitchRetryDelayMs);
		}
	}

	throw new Error(
		`Could not switch the database to WAL mode within ${busyTimeoutMs}ms`,
	);
}

export function createDatabase(options: DatabaseOptions): Database {
	const database = new Database(options.path, { create: true });

	database.run(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
	enableWriteAheadLog(database);
	database.run("PRAGMA foreign_keys = ON");

	return database;
}

export function createDrizzleClient(client: Database): QuizDatabase {
	return drizzle({ client, schema });
}
