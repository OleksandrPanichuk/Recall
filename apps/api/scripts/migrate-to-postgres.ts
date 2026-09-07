import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { RecallDatabase } from "@/db/client";
import { Database } from "@/db/connection";
import { PostgresTransaction } from "@/db/executor";
import * as schema from "@/db/schema";
import {
	AuthEngine,
	AuthService,
	PostgresAuthRepository,
} from "@/modules/auth";
import { PostgresUsersRepository, UsersService } from "@/modules/users";
import {
	migrateSqliteToPostgres,
	verifyMigration,
} from "@/persistence/postgres/etl";

class ScriptDatabase extends Database {
	constructor(readonly db: RecallDatabase) {
		super();
	}
}

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
	const [installed] = await client<{ present: boolean }[]>`
		select to_regclass('public.quizzes') is not null as present
	`;

	if (installed?.present !== true) {
		console.error(
			"this database has no schema yet — run `bun run db:migrate` against it first",
		);
		process.exit(1);
	}

	const db = drizzle({ client, schema });
	const database = new ScriptDatabase(db);
	const auth = new AuthService(
		new PostgresAuthRepository(database),
		new UsersService(new PostgresUsersRepository(database)),
		new AuthEngine(undefined),
		new PostgresTransaction(() => db),
	);
	const owner = await auth.ensureOwnerForTelegram(telegramUserId);

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
