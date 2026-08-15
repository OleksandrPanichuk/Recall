import type { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RebuildFailedError, UnsafeMigrationError } from "./migrator.errors";
import {
	appliedTimestamps,
	type JournalEntry,
	record,
} from "./migrator.journal";

const REBUILD_DIRECTIVE = "-- rebuild";

function rebuildMarker(statements: string): string | undefined {
	if (/pragma\s+foreign_keys/i.test(statements)) {
		return "PRAGMA foreign_keys";
	}

	if (statements.includes("__new_")) {
		return "__new_ table";
	}

	if (/\bdrop\s+table\b/i.test(statements)) {
		return "DROP TABLE";
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

export function applyBatch(
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

export function applyRebuild(
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

export function isRebuild(folder: string, entry: JournalEntry): boolean {
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

export function waitForPeer(
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
