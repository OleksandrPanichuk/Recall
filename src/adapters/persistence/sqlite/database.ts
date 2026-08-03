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
const inMemoryPath = ":memory:";

export class WriteAheadLogError extends Error {
	public readonly path: string;
	public readonly journalMode: string;

	constructor(path: string, journalMode: string) {
		super(
			`Could not switch ${path} to WAL mode within ${busyTimeoutMs}ms; the journal mode is still "${journalMode}". WAL needs shared memory, which network filesystems and some container volumes do not provide.`,
		);
		this.name = "WriteAheadLogError";
		this.path = path;
		this.journalMode = journalMode;
	}
}

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

function enableWriteAheadLog(database: Database, path: string): void {
	if (path === inMemoryPath) {
		return;
	}

	const deadline = Date.now() + busyTimeoutMs;
	let observed = "";

	do {
		try {
			observed = journalMode(database);

			if (observed === "wal") {
				return;
			}

			database.run("PRAGMA journal_mode = WAL");
			observed = journalMode(database);

			if (observed === "wal") {
				return;
			}
		} catch (error) {
			if (!isBusy(error)) {
				throw error;
			}
		}

		Bun.sleepSync(walSwitchRetryDelayMs);
	} while (Date.now() < deadline);

	throw new WriteAheadLogError(path, observed);
}

export function createDatabase(options: DatabaseOptions): Database {
	const database = new Database(options.path, { create: true });

	try {
		database.run(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
		enableWriteAheadLog(database, database.filename);
		database.run("PRAGMA foreign_keys = ON");
	} catch (error) {
		database.close();
		throw error;
	}

	return database;
}

function compactWriteAheadLog(database: Database): void {
	try {
		database.run("PRAGMA wal_checkpoint(TRUNCATE)");
		database.query("PRAGMA journal_mode = DELETE").all();
	} catch {
		// Closing must continue even when compaction cannot acquire the database lock.
	}
}

export function closeDatabase(database: Database): void {
	if (database.filename !== inMemoryPath) {
		compactWriteAheadLog(database);
	}

	database.close();
}

export function createDrizzleClient(client: Database): QuizDatabase {
	return drizzle({ client, schema });
}
