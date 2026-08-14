import { Database } from "bun:sqlite";
import { applicationTables } from "@/adapters/persistence/sqlite/schema-tables";

export class BackupError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BackupError";
	}
}

// `VACUUM INTO` copies inside a read transaction, so the result is consistent
// under load and has no `-wal` sidecar a hand-copied file would leave behind.
export function backupDatabase(databasePath: string, target: string): void {
	if (target.trim().length === 0) {
		throw new BackupError("A backup target path is required");
	}

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

export function assertRestorable(backupPath: string): void {
	let candidate: Database | undefined;
	let present: Set<string>;

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
