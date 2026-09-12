import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { PostgresOptions, RecallDatabase } from "./client";
import * as schema from "./schema";

export abstract class Database {
	abstract readonly db: RecallDatabase;
}

export class DatabaseHandle extends Database {
	constructor(readonly db: RecallDatabase) {
		super();
	}
}

export class DatabaseConnection extends Database {
	readonly client: postgres.Sql;
	readonly db: RecallDatabase;

	constructor(options: PostgresOptions) {
		super();
		this.client = postgres(options.url, {
			max: options.maxConnections ?? 10,
			prepare: false,
			idle_timeout: options.idleTimeoutSeconds ?? 30,
			max_lifetime: options.connectionLifetimeSeconds ?? 60 * 30,
			connection: {
				statement_timeout: options.statementTimeoutMs ?? 15_000,
			},
			onnotice: () => {},
		});
		this.db = drizzle({ client: this.client, schema });
	}

	async close(): Promise<void> {
		await this.client.end({ timeout: 5 });
	}
}
