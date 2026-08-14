import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { createDrizzleClient } from "./database";

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

export class UnsafeMigrationError extends Error {
	public readonly tag: string;
	public readonly marker: string;

	constructor(tag: string, marker: string) {
		super(
			`${tag}.sql rebuilds a table (${marker}). Drizzle applies every migration inside one transaction, where PRAGMA foreign_keys is a silent no-op, so the DROP TABLE would cascade child rows away and the rebuilt table would lose its STRICT modifier. Apply it by hand as described in README.md under "Table-rebuild migrations".`,
		);
		this.name = "UnsafeMigrationError";
		this.tag = tag;
		this.marker = marker;
	}
}

interface JournalEntry {
	readonly tag: string;
	readonly when: number;
}

interface Journal {
	readonly entries: readonly JournalEntry[];
}

function journalEntries(folder: string): readonly JournalEntry[] {
	const journal = JSON.parse(
		readFileSync(join(folder, "meta", "_journal.json"), "utf8"),
	) as Journal;

	return journal.entries;
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

function rebuildMarker(statements: string): string | undefined {
	if (/pragma\s+foreign_keys/i.test(statements)) {
		return "PRAGMA foreign_keys";
	}

	if (statements.includes("__new_")) {
		return "__new_ table";
	}

	return undefined;
}

// Bot and MCP server both migrate on start and Drizzle's migrator is not
// serialised, so losing that race to a peer that did the same work is success.
function runMigrations(
	database: Database,
	folder: string,
	before: ReadonlySet<number>,
): void {
	try {
		migrate(createDrizzleClient(database), { migrationsFolder: folder });
	} catch (error) {
		const pending = journalEntries(folder).filter(
			(entry) => !appliedTimestamps(database).includes(entry.when),
		);

		if (pending.length > 0 || before.size > 0) {
			throw error;
		}
	}
}

function assertNoRebuild(
	folder: string,
	entries: readonly JournalEntry[],
): void {
	for (const entry of entries) {
		const marker = rebuildMarker(
			readFileSync(join(folder, `${entry.tag}.sql`), "utf8"),
		);

		if (marker) {
			throw new UnsafeMigrationError(entry.tag, marker);
		}
	}
}

export function applyMigrations(
	database: Database,
	folder: string = migrationsFolder,
): readonly string[] {
	const applied = appliedTimestamps(database);
	const before = new Set(applied);
	const latest = applied.length === 0 ? undefined : Math.max(...applied);
	const entries = journalEntries(folder);

	assertNoRebuild(
		folder,
		entries.filter((entry) => latest === undefined || latest < entry.when),
	);

	runMigrations(database, folder, before);

	const tags = new Map(entries.map((entry) => [entry.when, entry.tag]));

	return appliedTimestamps(database)
		.filter((timestamp) => !before.has(timestamp))
		.sort((left, right) => left - right)
		.map((timestamp) => tags.get(timestamp) ?? String(timestamp));
}
