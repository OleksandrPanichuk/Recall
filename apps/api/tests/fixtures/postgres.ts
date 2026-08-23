import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const DEFAULT_POSTGRES_URL =
	"postgres://recall:recall@127.0.0.1:55432/recall";

export const postgresUrl = (): string =>
	process.env.TEST_DATABASE_URL ??
	process.env.DATABASE_URL ??
	DEFAULT_POSTGRES_URL;

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
	readonly schema: string;
	close(): Promise<void>;
}

let counter = 0;

export async function openPostgres(prefix: string): Promise<PostgresHarness> {
	counter += 1;
	const schema = `${prefix}_${process.pid}_${counter}`;
	const client = postgres(postgresUrl(), {
		max: 4,
		prepare: false,
		onnotice: () => {},
	});

	await client.unsafe(`create schema "${schema}"`);
	await client.unsafe(`set search_path to "${schema}"`);

	const scoped = postgres(postgresUrl(), {
		max: 4,
		prepare: false,
		onnotice: () => {},
		connection: { search_path: schema },
	});

	return {
		client: scoped,
		db: drizzle({ client: scoped }),
		schema,
		close: async () => {
			await scoped.end({ timeout: 5 });
			await client.unsafe(`drop schema if exists "${schema}" cascade`);
			await client.end({ timeout: 5 });
		},
	};
}
