import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const DEFAULT_POSTGRES_URL =
	"postgres://recall:recall@127.0.0.1:55432/recall";

export const postgresUrl = (): string =>
	process.env.TEST_DATABASE_URL ??
	process.env.DATABASE_URL ??
	DEFAULT_POSTGRES_URL;

const withDatabase = (url: string, database: string): string => {
	const parsed = new URL(url);

	parsed.pathname = `/${database}`;

	return parsed.toString();
};

export async function postgresAvailable(): Promise<boolean> {
	const client = postgres(postgresUrl(), {
		max: 1,
		prepare: false,
		connect_timeout: 2,
		onnotice: () => {},
	});

	try {
		await client`select 1`;

		return true;
	} catch {
		return false;
	} finally {
		await client.end({ timeout: 1 });
	}
}

export interface PostgresHarness {
	readonly client: postgres.Sql;
	readonly db: PostgresJsDatabase;
	readonly database: string;
	readonly schema: string;
	close(): Promise<void>;
}

let counter = 0;

// drizzle-kit writes REFERENCES "public"."…" into every foreign key, so a
// per-run schema leaves the constraints pointing at an empty public. Each run
// gets its own database instead, where public is the right answer.
export async function openPostgres(prefix: string): Promise<PostgresHarness> {
	counter += 1;

	const database = `recall_${prefix}_${process.pid}_${counter}`.toLowerCase();
	const base = postgresUrl();

	const admin = () =>
		postgres(base, { max: 1, prepare: false, onnotice: () => {} });

	const creator = admin();

	try {
		await creator.unsafe(`drop database if exists "${database}" with (force)`);
		await creator.unsafe(`create database "${database}"`);
	} finally {
		await creator.end({ timeout: 5 });
	}

	const client = postgres(withDatabase(base, database), {
		max: 1,
		prepare: false,
		onnotice: () => {},
	});

	return {
		client,
		db: drizzle({ client }),
		database,
		schema: "public",
		close: async () => {
			await client.end({ timeout: 5 });

			const dropper = admin();

			try {
				await dropper.unsafe(
					`drop database if exists "${database}" with (force)`,
				);
			} finally {
				await dropper.end({ timeout: 5 });
			}
		},
	};
}

export async function applyMigration(harness: PostgresHarness): Promise<void> {
	const { readFileSync } = await import("node:fs");
	const { join } = await import("node:path");
	const file = join(
		import.meta.dir,
		"..",
		"..",
		"drizzle-postgres",
		"0000_tan_power_man.sql",
	);

	for (const statement of readFileSync(file, "utf8")
		.split("--> statement-breakpoint")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)) {
		await harness.client.unsafe(statement);
	}
}
