import { afterAll, beforeAll } from "bun:test";
import { drizzle } from "drizzle-orm/postgres-js";
import type { OwnerId } from "@/application/ports/owner";
import type { RecallDatabase } from "@/persistence/postgres/client";
import * as schema from "@/persistence/postgres/schema";
import {
	createPostgresUnitOfWork,
	readOnlyScope,
} from "@/persistence/postgres/unit-of-work";
import { describeOwnership } from "../../contracts/ownership.contract";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
	seedOwner,
} from "../../fixtures/postgres";

const available = await postgresAvailable();

let harness: PostgresHarness;
let db: RecallDatabase;
let mine: OwnerId;
let theirs: OwnerId;

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("ownership");
	await applyMigration(harness);
	db = drizzle({ client: harness.client, schema });
	mine = await seedOwner(harness, "the owner");
	theirs = await seedOwner(harness, "somebody else");
});

afterAll(async () => {
	await harness?.close();
});

describeOwnership(
	"postgres",
	() => ({
		mine: {
			unitOfWork: createPostgresUnitOfWork(db, mine),
			scope: readOnlyScope(db, mine),
		},
		theirs: {
			unitOfWork: createPostgresUnitOfWork(db, theirs),
			scope: readOnlyScope(db, theirs),
		},
		reset: async () => {
			await harness.client.unsafe(
				"truncate pages, quizzes, attempts, review_states, study_settings, term_pairs cascade",
			);
		},
	}),
	{ skip: !available },
);
