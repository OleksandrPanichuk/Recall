import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createDatabase } from "@/adapters/persistence/sqlite/database";
import { applyMigrations } from "@/adapters/persistence/sqlite/migrator";
import { loadEnvironment } from "@/infrastructure/config/env";

function reasonOf(error: unknown): string {
	return error instanceof Error ? error.message : "unknown failure";
}

function migrate(): number {
	let environment: ReturnType<typeof loadEnvironment>;

	try {
		environment = loadEnvironment();
	} catch (error) {
		console.error(reasonOf(error));

		return 1;
	}

	console.log(`Opening database at ${environment.databasePath}`);
	mkdirSync(dirname(environment.databasePath), { recursive: true });

	let database: ReturnType<typeof createDatabase>;

	try {
		database = createDatabase({ path: environment.databasePath });
	} catch (error) {
		console.error(`Could not open the database: ${reasonOf(error)}`);

		return 1;
	}

	try {
		const applied = applyMigrations(database);

		if (applied.length === 0) {
			console.log("database is up to date");
		} else {
			console.log(`applied ${applied.length} migration(s):`);

			for (const tag of applied) {
				console.log(`- ${tag}`);
			}
		}

		return 0;
	} catch (error) {
		console.error(`Migration failed: ${reasonOf(error)}`);

		return 1;
	} finally {
		database.close();
	}
}

process.exit(migrate());
