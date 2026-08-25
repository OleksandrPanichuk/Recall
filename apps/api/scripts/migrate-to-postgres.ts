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

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

try {
	// The schema is drizzle-kit's job. Applying it from here used to be possible
	// with APPLY_SCHEMA=1, but it wrote the tables without recording them in
	// drizzle's journal, so the next `db:migrate` on that database tried to create
	// everything again and failed.
	const [schema] = await client<{ present: boolean }[]>`
		select to_regclass('public.quizzes') is not null as present
	`;

	if (schema?.present !== true) {
		console.error(
			"this database has no schema yet — run `bun run db:migrate` against it first",
		);
		process.exit(1);
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
