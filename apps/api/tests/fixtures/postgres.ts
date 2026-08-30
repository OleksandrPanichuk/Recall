import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { type OwnerId, toOwnerId } from "@/application/ports/owner";

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
	readonly url: string;
	readonly schema: string;
	close(): Promise<void>;
}

let counter = 0;

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

	const url = withDatabase(base, database);
	const client = postgres(url, {
		max: 1,
		prepare: false,
		onnotice: () => {},
	});

	return {
		client,
		db: drizzle({ client }),
		database,
		url,
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

export const migrationsDirectory = (from: string): string => from;

export async function applyMigration(harness: PostgresHarness): Promise<void> {
	const { readdirSync, readFileSync } = await import("node:fs");
	const { join } = await import("node:path");
	const directory = join(import.meta.dir, "..", "..", "drizzle-postgres");
	const names = readdirSync(directory)
		.filter((entry) => entry.endsWith(".sql"))
		.sort();

	if (names.length === 0) {
		throw new Error(`no migration found in ${directory}`);
	}

	for (const name of names) {
		for (const statement of readFileSync(join(directory, name), "utf8")
			.split("--> statement-breakpoint")
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0)) {
			await harness.client.unsafe(statement);
		}
	}
}

export async function seedOwner(
	harness: PostgresHarness,
	name: string,
): Promise<OwnerId> {
	const id = crypto.randomUUID();

	await harness.client`
		insert into "user" (id, name, email)
		values (${id}::text, ${name}::text, ${`${id}@telegram.invalid`}::text)
	`;

	return toOwnerId(id);
}

export async function seedTelegramOwner(
	harness: PostgresHarness,
	telegramUserId: number,
): Promise<OwnerId> {
	const owner = await seedOwner(harness, `telegram ${telegramUserId}`);

	await harness.client`
		insert into account (id, account_id, provider_id, user_id)
		values (
			${crypto.randomUUID()}::text, ${String(telegramUserId)}::text,
			'telegram'::text, ${String(owner)}::text
		)
	`;

	return owner;
}
