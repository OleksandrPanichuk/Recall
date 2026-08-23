import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import {
	migrateSqliteToPostgres,
	verifyMigration,
} from "@/persistence/postgres/etl";

const sqlitePath = process.argv[2];
const url = process.argv[3] ?? process.env.DATABASE_URL;

if (sqlitePath === undefined || url === undefined) {
	console.error(
		"Usage: bun run ./scripts/migrate-to-postgres.ts <sqlite-file> [postgres-url]",
	);
	process.exit(1);
}

const migrationsDirectory = join(import.meta.dir, "..", "drizzle-postgres");

const migrationFile = (): string => {
	const [name] = readdirSync(migrationsDirectory)
		.filter((entry) => entry.endsWith(".sql"))
		.sort();

	if (name === undefined) {
		throw new Error(`no migration found in ${migrationsDirectory}`);
	}

	return join(migrationsDirectory, name);
};

const statements = (): readonly string[] =>
	readFileSync(migrationFile(), "utf8")
		.split("--> statement-breakpoint")
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0);

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

try {
	if (process.env.APPLY_SCHEMA === "1") {
		for (const statement of statements()) {
			await client.unsafe(statement);
		}

		console.log("schema applied");
	}

	const report = await migrateSqliteToPostgres({ sqlitePath, client });

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
