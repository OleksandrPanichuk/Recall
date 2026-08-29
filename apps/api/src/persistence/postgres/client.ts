import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type RecallDatabase = PostgresJsDatabase<typeof schema>;

export interface PostgresOptions {
	readonly url: string;
	readonly maxConnections?: number;
	readonly statementTimeoutMs?: number;
	readonly idleTimeoutSeconds?: number;
	readonly connectionLifetimeSeconds?: number;
}

export interface PostgresConnection {
	readonly client: postgres.Sql;
	readonly db: RecallDatabase;
	close(): Promise<void>;
}

export function createPostgresConnection(
	options: PostgresOptions,
): PostgresConnection {
	const client = postgres(options.url, {
		max: options.maxConnections ?? 10,
		prepare: false,
		idle_timeout: options.idleTimeoutSeconds ?? 30,
		max_lifetime: options.connectionLifetimeSeconds ?? 60 * 30,
		connection: {
			statement_timeout: options.statementTimeoutMs ?? 15_000,
		},
		onnotice: () => {},
	});

	return {
		client,
		db: drizzle({ client, schema }),
		close: async () => {
			await client.end({ timeout: 5 });
		},
	};
}
