import { Database } from "bun:sqlite";
import { applicationTables } from "@/adapters/persistence/sqlite/schema-tables";

export class BackupError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BackupError";
	}
}

/**
 * `VACUUM INTO` is SQLite's own supported way to take a consistent copy while a
 * database is in use: it runs inside a read transaction, so the result is a
 * single file with no `-wal` sidecar to lose. Copying `quiz.sqlite` by hand is
 * what people get wrong, because the newest writes may still live in the WAL.
 */
export function backupDatabase(databasePath: string, target: string): void {
	if (target.trim().length === 0) {
		throw new BackupError("A backup target path is required");
	}

	// Read-only: a backup must never be able to alter the live database.
	const source = new Database(databasePath, { readonly: true });

	try {
		source.run(`VACUUM INTO ${quote(target)}`);
	} catch (error) {
		throw new BackupError(
			`Could not write the backup to ${target}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	} finally {
		source.close();
	}
}

/**
 * Refuses anything that is not one of our databases, so a restore cannot
 * silently install an unrelated or truncated file over real history.
 */
export function assertRestorable(backupPath: string): void {
	let candidate: Database | undefined;
	let present: Set<string>;

	// bun:sqlite opens lazily, so a file that is not a database only fails when
	// the first statement runs — both have to be inside the guard.
	try {
		candidate = new Database(backupPath, { readonly: true });
		present = new Set(
			candidate
				.query<{ name: string }, []>(
					"SELECT name FROM sqlite_master WHERE type = 'table'",
				)
				.all()
				.map((row) => row.name),
		);
	} catch {
		candidate?.close();

		throw new BackupError(`${backupPath} is not a readable SQLite database`);
	}

	try {
		const missing = applicationTables.filter((table) => !present.has(table));

		if (missing.length > 0) {
			throw new BackupError(
				`${backupPath} is missing the tables ${missing.join(", ")}; it is not a Recall backup`,
			);
		}

		if (!present.has("__drizzle_migrations")) {
			throw new BackupError(
				`${backupPath} has no migration ledger; it is not a Recall backup`,
			);
		}
	} finally {
		candidate.close();
	}
}

const quote = (value: string): string => `'${value.replaceAll("'", "''")}'`;
