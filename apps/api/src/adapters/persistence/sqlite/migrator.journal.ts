import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const journalRelativePath = join("drizzle", "meta", "_journal.json");
const projectRootSearchDepth = 8;

function resolveMigrationsFolder(): string {
	let candidate = import.meta.dir;

	for (let level = 0; level < projectRootSearchDepth; level += 1) {
		if (existsSync(join(candidate, journalRelativePath))) {
			return join(candidate, "drizzle");
		}

		const parent = dirname(candidate);

		if (parent === candidate) {
			break;
		}

		candidate = parent;
	}

	throw new Error(
		`Could not locate ${journalRelativePath} above ${import.meta.dir}`,
	);
}

export const migrationsFolder = resolveMigrationsFolder();

export interface JournalEntry {
	readonly tag: string;
	readonly when: number;
}

interface Journal {
	readonly entries: readonly JournalEntry[];
}

export function journalEntries(folder: string): readonly JournalEntry[] {
	const journal = JSON.parse(
		readFileSync(join(folder, "meta", "_journal.json"), "utf8"),
	) as Journal;

	return journal.entries;
}

export function appliedTimestamps(database: Database): readonly number[] {
	const ledger = database
		.query<{ name: string }, []>(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
		)
		.all();

	if (ledger.length === 0) {
		return [];
	}

	return database
		.query<{ created_at: number }, []>(
			"SELECT created_at FROM __drizzle_migrations",
		)
		.all()
		.map((row) => Number(row.created_at));
}

export function ledgerHash(sql: string): string {
	return createHash("sha256").update(sql).digest("hex");
}

export function ensureLedger(database: Database): void {
	database.run(
		"CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)",
	);
}

export function record(database: Database, sql: string, when: number): void {
	database.run(
		'INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES (?, ?)',
		[ledgerHash(sql), when],
	);
}
