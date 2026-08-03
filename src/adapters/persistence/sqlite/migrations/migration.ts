import type { Database } from "bun:sqlite";

export interface Migration {
	readonly version: number;
	readonly name: string;
	up(database: Database): void;
}

export interface AppliedMigration {
	readonly version: number;
	readonly name: string;
	readonly appliedAt: string;
}

interface AppliedMigrationRow {
	readonly version: number;
	readonly name: string;
	readonly applied_at: string;
}

const LEDGER_TABLE = "schema_migrations";

const createLedgerSql = `CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE} (
	version INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	applied_at TEXT NOT NULL
)`;

const insertLedgerSql = `INSERT INTO ${LEDGER_TABLE} (version, name, applied_at)
VALUES (?, ?, ?)`;

const selectLedgerSql = `SELECT version, name, applied_at FROM ${LEDGER_TABLE}
ORDER BY version`;

function toAppliedMigration(row: AppliedMigrationRow): AppliedMigration {
	return {
		version: row.version,
		name: row.name,
		appliedAt: row.applied_at,
	};
}

function ledgerExists(database: Database): boolean {
	return (
		database
			.query<{ name: string }, [string]>(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
			)
			.get(LEDGER_TABLE) !== null
	);
}

/**
 * Rejects an unusable version before any schema change happens. The offending
 * version is echoed because it is an author-written constant, never user input,
 * and it is the fastest way to find the migration module at fault.
 */
function assertVersionsAreUsable(migrations: readonly Migration[]): void {
	const seen = new Set<number>();

	for (const migration of migrations) {
		const { version } = migration;

		// Versions start at 1: 0 is reserved as the "nothing applied" sentinel
		// for any future `MAX(version)` query.
		if (!Number.isSafeInteger(version) || version < 1) {
			throw new Error(`Invalid migration version ${version}`);
		}

		if (seen.has(version)) {
			throw new Error(`Duplicate migration version ${version}`);
		}

		seen.add(version);
	}
}

/**
 * Runs one migration's `up`, naming it if it fails. SQLite reports only the
 * offending SQL (`near "TABEL": syntax error`), which is useless for locating
 * the module in a batch of eight.
 */
function applyUp(migration: Migration, database: Database): void {
	try {
		migration.up(database);
	} catch (error) {
		throw new Error(
			`Migration ${migration.version} (${migration.name}) failed`,
			{ cause: error },
		);
	}
}

/**
 * Reads the migration ledger. A database that was never migrated has no ledger
 * table, and reading must not create one, so the missing table means "nothing
 * applied" rather than an error.
 */
export function appliedMigrations(
	database: Database,
): readonly AppliedMigration[] {
	if (!ledgerExists(database)) {
		return [];
	}

	return database
		.query<AppliedMigrationRow, []>(selectLedgerSql)
		.all()
		.map(toAppliedMigration);
}

/**
 * Applies every migration that this database has not seen yet, in ascending
 * version order, and returns only what this call applied.
 *
 * Each migration runs in its own transaction together with its ledger insert,
 * so a failure can neither leave half a schema behind nor record itself as
 * applied. Migrations already applied by an earlier call stay committed, and a
 * failure aborts the batch rather than continuing with later versions.
 *
 * `up` may issue DDL and DML only. It must not issue `BEGIN`, `COMMIT`,
 * `ROLLBACK`, `VACUUM`, or any `PRAGMA` that has to run outside a transaction —
 * a `PRAGMA foreign_keys` change silently no-ops there, and ending the
 * transaction itself is worse than loud: the schema change survives while the
 * ledger stays empty, so the next run re-applies the same version onto objects
 * that already exist and the database can no longer be migrated without manual
 * repair. A migration that genuinely needs SQLite's non-transactional
 * table-rebuild recipe requires an explicitly opted-in non-transactional
 * variant of this runner, never a workaround inside `up`.
 */
export function runMigrations(
	database: Database,
	migrations: readonly Migration[],
): readonly AppliedMigration[] {
	assertVersionsAreUsable(migrations);

	database.run(createLedgerSql);

	const alreadyApplied = new Set(
		appliedMigrations(database).map((migration) => migration.version),
	);
	const insert = database.query<unknown, [number, string, string]>(
		insertLedgerSql,
	);
	const applied: AppliedMigration[] = [];

	const pending = [...migrations]
		.sort((left, right) => left.version - right.version)
		.filter((migration) => !alreadyApplied.has(migration.version));

	for (const migration of pending) {
		const record: AppliedMigration = {
			version: migration.version,
			name: migration.name,
			appliedAt: new Date().toISOString(),
		};

		database.transaction(() => {
			applyUp(migration, database);
			insert.run(record.version, record.name, record.appliedAt);
		})();

		applied.push(record);
	}

	return applied;
}
