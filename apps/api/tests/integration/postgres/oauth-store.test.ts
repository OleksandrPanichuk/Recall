import { afterAll, beforeAll } from "bun:test";
import { drizzle } from "drizzle-orm/postgres-js";
import type { OwnerId } from "@/application/ports/owner";
import type { RecallDatabase } from "@/persistence/postgres/client";
import { createPostgresOAuthStore } from "@/persistence/postgres/oauth.store";
import * as schema from "@/persistence/postgres/schema";
import { describeOAuthStore } from "../../contracts/oauth-store.contract";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
	seedOwner,
} from "../../fixtures/postgres";

const available = await postgresAvailable();
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
		store: createPostgresOAuthStore(db, () => current),
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
