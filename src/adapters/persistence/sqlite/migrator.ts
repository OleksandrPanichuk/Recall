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

export class UnsafeMigrationError extends Error {
	public readonly tag: string;
	public readonly marker: string;

	constructor(tag: string, marker: string) {
		super(
			`${tag}.sql rebuilds a table (${marker}) but is not declared as a rebuild. Add the "-- rebuild" marker on the first line so the migrator applies it with foreign keys disabled outside a transaction; applying it inline would let the DROP TABLE cascade child rows away.`,
		);
		this.name = "UnsafeMigrationError";
		this.tag = tag;
		this.marker = marker;
	}
}

export class RebuildFailedError extends Error {
	public readonly tag: string;
	public readonly violations: number;

	constructor(tag: string, violations: number) {
		super(
			`${tag}.sql left ${violations} foreign key violation(s); the rebuild was rolled back and nothing was recorded.`,
		);
		this.name = "RebuildFailedError";
		this.tag = tag;
		this.violations = violations;
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

const REBUILD_DIRECTIVE = "-- rebuild";

function rebuildMarker(statements: string): string | undefined {
	if (/pragma\s+foreign_keys/i.test(statements)) {
		return "PRAGMA foreign_keys";
	}

	if (statements.includes("__new_")) {
		return "__new_ table";
	}

	return undefined;
}

function isDeclaredRebuild(sql: string): boolean {
	return sql.trimStart().startsWith(REBUILD_DIRECTIVE);
}

function statementsOf(sql: string): readonly string[] {
	return sql
		.split("--> statement-breakpoint")
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0)
		.filter((statement) => !/^\s*pragma\s+foreign_keys/i.test(statement));
}

function ledgerHash(sql: string): string {
	return createHash("sha256").update(sql).digest("hex");
}

function ensureLedger(database: Database): void {
	database.run(
		"CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)",
	);
}

function record(database: Database, sql: string, when: number): void {
	database.run(
		'INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES (?, ?)',
		[ledgerHash(sql), when],
	);
}

// Safe migrations keep their all-or-nothing guarantee: a broken one anywhere in
// the run leaves the database exactly as it was. Only a rebuild has to stand
// alone, because its pragma cannot work inside a transaction.
function applyBatch(
	database: Database,
	folder: string,
	entries: readonly JournalEntry[],
): void {
	if (entries.length === 0) {
		return;
	}

	database.run("BEGIN IMMEDIATE");

	try {
		for (const entry of entries) {
			const sql = readFileSync(join(folder, `${entry.tag}.sql`), "utf8");

			for (const statement of statementsOf(sql)) {
				database.run(statement);
			}

			record(database, sql, entry.when);
		}

		database.run("COMMIT");
	} catch (error) {
		database.run("ROLLBACK");

		throw error;
	}
}

// A rebuild drops and recreates a table, and SQLite only honours
// PRAGMA foreign_keys outside a transaction — set inside one it is a silent
// no-op and the DROP cascades every child row away. So the pragma is disabled
// first, and foreign_key_check verifies the result before the commit decides.
function applyRebuild(
	database: Database,
	entry: JournalEntry,
	sql: string,
): void {
	database.run("PRAGMA foreign_keys = OFF");

	try {
		database.run("BEGIN IMMEDIATE");

		try {
			for (const statement of statementsOf(sql)) {
				database.run(statement);
			}

			const violations = database
				.query<{ count: number }, []>("PRAGMA foreign_key_check")
				.all().length;

			if (violations > 0) {
				database.run("ROLLBACK");

				throw new RebuildFailedError(entry.tag, violations);
			}

			record(database, sql, entry.when);
			database.run("COMMIT");
		} catch (error) {
			if (!(error instanceof RebuildFailedError)) {
				database.run("ROLLBACK");
			}

			throw error;
		}
	} finally {
		database.run("PRAGMA foreign_keys = ON");
	}
}

function isRebuild(folder: string, entry: JournalEntry): boolean {
	const sql = readFileSync(join(folder, `${entry.tag}.sql`), "utf8");

	if (isDeclaredRebuild(sql)) {
		return true;
	}

	const marker = rebuildMarker(sql);

	if (marker) {
		throw new UnsafeMigrationError(entry.tag, marker);
	}

	return false;
}

const PEER_WAIT_ATTEMPTS = 50;
const PEER_WAIT_MS = 20;

function waitForPeer(
	database: Database,
	pending: readonly JournalEntry[],
): boolean {
	for (let attempt = 0; attempt < PEER_WAIT_ATTEMPTS; attempt += 1) {
		const now = appliedTimestamps(database);

		if (pending.every((entry) => now.includes(entry.when))) {
			return true;
		}

		Bun.sleepSync(PEER_WAIT_MS);
	}

	return false;
}

export function applyMigrations(
	database: Database,
	folder: string = migrationsFolder,
): readonly string[] {
	ensureLedger(database);

	const applied = appliedTimestamps(database);
	const latest = applied.length === 0 ? undefined : Math.max(...applied);
	const pending = journalEntries(folder)
		.toSorted((left, right) => left.when - right.when)
		.filter((entry) => latest === undefined || latest < entry.when);

	const rebuilds = new Set(
		pending
			.filter((entry) => isRebuild(folder, entry))
			.map((entry) => entry.tag),
	);

	let batch: JournalEntry[] = [];

	try {
		for (const entry of pending) {
			if (!rebuilds.has(entry.tag)) {
				batch.push(entry);

				continue;
			}

			applyBatch(database, folder, batch);
			batch = [];
			applyRebuild(
				database,
				entry,
				readFileSync(join(folder, `${entry.tag}.sql`), "utf8"),
			);
		}

		applyBatch(database, folder, batch);
	} catch (error) {
		// Bot and MCP server both migrate on start and BEGIN IMMEDIATE lets only
		// one of them in, so losing the race is success once the peer has finished.
		if (!waitForPeer(database, pending)) {
			throw error;
		}
	}

	const now = new Set(appliedTimestamps(database));

	return pending
		.filter((entry) => now.has(entry.when))
		.map((entry) => entry.tag);
}
