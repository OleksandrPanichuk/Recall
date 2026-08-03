import type { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { createDrizzleClient } from "./database";

export const migrationsFolder = join(
	import.meta.dir,
	"..",
	"..",
	"..",
	"..",
	"drizzle",
);

interface JournalEntry {
	readonly tag: string;
	readonly when: number;
}

interface Journal {
	readonly entries: readonly JournalEntry[];
}

function migrationTags(folder: string): ReadonlyMap<number, string> {
	const journal = JSON.parse(
		readFileSync(join(folder, "meta", "_journal.json"), "utf8"),
	) as Journal;

	return new Map(journal.entries.map((entry) => [entry.when, entry.tag]));
}

function appliedTimestamps(database: Database): readonly number[] {
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

export function applyMigrations(
	database: Database,
	folder: string = migrationsFolder,
): readonly string[] {
	const before = new Set(appliedTimestamps(database));

	migrate(createDrizzleClient(database), { migrationsFolder: folder });

	const tags = migrationTags(folder);

	return appliedTimestamps(database)
		.filter((timestamp) => !before.has(timestamp))
		.sort((left, right) => left - right)
		.map((timestamp) => tags.get(timestamp) ?? String(timestamp));
}
