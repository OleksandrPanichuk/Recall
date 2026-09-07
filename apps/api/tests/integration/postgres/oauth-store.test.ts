import { afterAll, beforeAll } from "bun:test";
import { drizzle } from "drizzle-orm/postgres-js";
import type { OwnerId } from "@/application/ports/owner";
import type { RecallDatabase } from "@/db/client";
import { Database, DatabaseHandle } from "@/db/connection";
import * as schema from "@/db/schema";
import { PostgresOAuthRepository } from "@/modules/oauth";
import { describeOAuthStore } from "../../contracts/oauth-store.contract";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
	seedOwner,
} from "../../fixtures/postgres";

const available = await postgresAvailable();

const databaseOf = (db: RecallDatabase): Database => new DatabaseHandle(db);
const START = new Date("2026-08-01T10:00:00.000Z");

let harness: PostgresHarness;
let db: RecallDatabase;
let owner: OwnerId;
let current = new Date(START);

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("oauth-store");
	await applyMigration(harness);
	db = drizzle({ client: harness.client, schema });
	owner = await seedOwner(harness, "oauth owner");
});

afterAll(async () => {
	await harness?.close();
});

describeOAuthStore(
	"postgres",
	() => ({
		store: new PostgresOAuthRepository(databaseOf(db), {
			now: () => current,
		}),
		owner: String(owner),
		at: () => current,
		travel: (milliseconds) => {
			current = new Date(current.getTime() + milliseconds);
		},
		reset: async () => {
			current = new Date(START);
			await harness.client.unsafe(
				"truncate oauth_clients, oauth_codes, oauth_tokens cascade",
			);
		},
	}),
	{ skip: !available },
);
