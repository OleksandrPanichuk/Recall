import { Database } from "bun:sqlite";

/**
 * How long a writer waits for a competing lock before failing with
 * `SQLITE_BUSY`. A single-process personal bot only contends with its own
 * migration script and backup job, so a few seconds is enough.
 */
const BUSY_TIMEOUT_MS = 5000;

/**
 * Opens the application database with the pragmas the persistence adapter
 * depends on. Foreign keys are off by default in SQLite and are per-connection,
 * so every connection must be created here rather than with `new Database`.
 */
export function createDatabase(options: { readonly path: string }): Database {
	const database = new Database(options.path, { create: true });

	// A pragma value cannot be a bound parameter, hence the interpolated
	// module constant. WAL is silently ignored for `:memory:` (SQLite keeps
	// reporting `memory`), so this sequence is safe for tests too.
	database.run("PRAGMA journal_mode = WAL");
	database.run("PRAGMA foreign_keys = ON");
	database.run(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);

	return database;
}
