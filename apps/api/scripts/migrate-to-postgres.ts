import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
	migrateSqliteToPostgres,
	verifyMigration,
} from "@/persistence/postgres/etl";
import { ensureTelegramOwner } from "@/persistence/postgres/owner";

const sqlitePath = process.argv[2];
const url = process.argv[3] ?? process.env.DATABASE_URL;
const telegramUserId = Number(process.env.ALLOWED_TELEGRAM_USER_ID ?? "");

if (sqlitePath === undefined || url === undefined) {
	console.error(
		"Usage: bun run ./scripts/migrate-to-postgres.ts <sqlite-file> [postgres-url]",
	);
	process.exit(1);
}

if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) {
	console.error(
		"ALLOWED_TELEGRAM_USER_ID must name the telegram account that will own the imported data",
	);
	process.exit(1);
}

const migrationsDirectory = join(import.meta.dir, "..", "drizzle-postgres");

const migrationFiles = (): readonly string[] => {
	const names = readdirSync(migrationsDirectory)
		.filter((entry) => entry.endsWith(".sql"))
		.sort();

	if (names.length === 0) {
		throw new Error(`no migration found in ${migrationsDirectory}`);
	}

	return names.map((name) => join(migrationsDirectory, name));
};

const statements = (): readonly string[] =>
	migrationFiles().flatMap((file) =>
		readFileSync(file, "utf8")
			.split("--> statement-breakpoint")
			.map((statement) => statement.trim())
			.filter((statement) => statement.length > 0),
	);

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

try {
	if (process.env.APPLY_SCHEMA === "1") {
		for (const statement of statements()) {
			await client.unsafe(statement);
		}

		console.log("schema applied");
	}

	// The import has to land under a user, and it must be the same user the bot
	// will hand the platform to — so it is resolved from the telegram id, and
	// created if the owner has not linked yet.
	const owner = await ensureTelegramOwner(drizzle({ client }), telegramUserId);

	const report = await migrateSqliteToPostgres({ sqlitePath, client, owner });

	console.log("\nrows written");

	for (const [table, rows] of Object.entries(report.inserted)) {
		console.log(`  ${table.padEnd(20)} ${String(rows).padStart(5)}`);
	}

	if (report.notes.length > 0) {
		console.log("\nnotes");

		for (const note of report.notes) {
			console.log(`  - ${note}`);
		}
	}

	const issues = await verifyMigration({ sqlitePath, client });

	if (issues.length > 0) {
		console.error("\nverification FAILED");

		for (const issue of issues) {
			console.error(
				`  ${issue.check}: expected ${issue.expected}, found ${issue.actual}`,
			);
		}

		process.exitCode = 1;
	} else {
		console.log("\nverification passed: every mapped table and total agrees");
	}
} finally {
	await client.end({ timeout: 5 });
}
