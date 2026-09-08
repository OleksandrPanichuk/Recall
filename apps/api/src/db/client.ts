import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "./schema";

export type RecallDatabase = PostgresJsDatabase<typeof schema>;

export interface PostgresOptions {
	readonly url: string;
	readonly maxConnections?: number;
	readonly statementTimeoutMs?: number;
	readonly idleTimeoutSeconds?: number;
	readonly connectionLifetimeSeconds?: number;
}
