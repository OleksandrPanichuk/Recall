import { eq } from "drizzle-orm";
import {
	createDatabase,
	createDrizzleClient,
} from "@/adapters/persistence/sqlite/database";
import { applyMigrations } from "@/adapters/persistence/sqlite/migrator";
import { quizSets } from "@/adapters/persistence/sqlite/schema";
import { createSqliteTransaction } from "@/adapters/persistence/sqlite/sqlite-transaction";

/**
 * A worker for the concurrency test. Repeats the read-then-write transaction
 * shape every repository save() uses, and reports how many writes were lost to
 * lock contention.
 */
const tag = process.argv[2] ?? "worker";
const rounds = Number(process.argv[3] ?? 40);
const databasePath = process.argv[4] ?? "";

const raw = createDatabase({ path: databasePath });

applyMigrations(raw);

const database = createDrizzleClient(raw);
const transaction = createSqliteTransaction(database);
let committed = 0;
let locked = 0;

for (let round = 0; round < rounds; round += 1) {
	const id = `${tag}-${round}`;

	try {
		transaction.run(() => {
			database.select().from(quizSets).where(eq(quizSets.id, id)).get();
			// Widen the window between the read and the write so the two workers
			// genuinely overlap rather than passing each other by luck.
			Bun.sleepSync(2);
			database
				.insert(quizSets)
				.values({
					id,
					title: "Concurrency",
					language: "uk",
					status: "draft",
					createdAt: "2026-08-01T00:00:00.000Z",
					updatedAt: "2026-08-01T00:00:00.000Z",
					tags: "[]",
				})
				.run();
		});
		committed += 1;
	} catch (error) {
		if (/busy|locked/i.test((error as Error).message)) {
			locked += 1;
		} else {
			throw error;
		}
	}
}

raw.close();
console.log(JSON.stringify({ tag, committed, locked }));
