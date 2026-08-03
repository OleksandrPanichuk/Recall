// Operator entrypoint for schema migrations. It is intentionally the only place
// that applies migrations to the configured database; the bot itself never
// migrates on startup, so a schema change is always a deliberate action.
import { createDatabase } from "@/adapters/persistence/sqlite/database";
import { migrations } from "@/adapters/persistence/sqlite/migrations/index-migrations";
import { runMigrations } from "@/adapters/persistence/sqlite/migrations/migration";
import { EnvironmentError, loadEnvironment } from "@/infrastructure/config/env";

function main(): void {
	// Only the database path is printed. The bot token and the allowed Telegram
	// user id stay out of the log, as they do in the Telegram entrypoint.
	const environment = loadEnvironment();

	// `createDatabase` sets `busy_timeout = 5000`, so opening a database another
	// process is writing now waits instead of failing immediately. Without this
	// line a contended run looks like a hang for up to five seconds.
	console.log(
		`Opening ${environment.databasePath} (waits up to 5s for a competing writer).`,
	);

	const database = createDatabase({ path: environment.databasePath });

	try {
		const applied = runMigrations(database, migrations);

		if (applied.length === 0) {
			console.log("database is up to date");

			return;
		}

		for (const migration of applied) {
			console.log(`applied ${migration.version} (${migration.name})`);
		}
	} finally {
		database.close();
	}
}

try {
	main();
} catch (error) {
	if (error instanceof EnvironmentError) {
		console.error(error.message);
	} else {
		// A migration failure already names the offending version; the cause holds
		// the SQLite message an operator needs to repair the database by hand.
		console.error(error);
	}

	process.exit(1);
}
