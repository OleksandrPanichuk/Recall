import type { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	appliedTimestamps,
	ensureLedger,
	type JournalEntry,
	journalEntries,
	migrationsFolder,
} from "./migrator.journal";
import {
	applyBatch,
	applyRebuild,
	isRebuild,
	waitForPeer,
} from "./migrator.runner";

export {
	RebuildFailedError,
	UnsafeMigrationError,
} from "./migrator.errors";
export { migrationsFolder } from "./migrator.journal";

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
		if (!waitForPeer(database, pending)) {
			throw error;
		}
	}

	const now = new Set(appliedTimestamps(database));

	return pending
		.filter((entry) => now.has(entry.when))
		.map((entry) => entry.tag);
}
