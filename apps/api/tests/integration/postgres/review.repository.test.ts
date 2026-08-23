import { afterAll, beforeAll } from "bun:test";
import { drizzle } from "drizzle-orm/postgres-js";
import type { RecallDatabase } from "@/persistence/postgres/client";
import * as schema from "@/persistence/postgres/schema";
import {
	createPostgresUnitOfWork,
	readOnlyScope,
} from "@/persistence/postgres/unit-of-work";
import { describeReviewRepository } from "../../contracts/review.repository.contract";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
} from "../../fixtures/postgres";

const available = await postgresAvailable();

let harness: PostgresHarness;
let db: RecallDatabase;

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("reviews");
	await applyMigration(harness);
	db = drizzle({ client: harness.client, schema });
});

afterAll(async () => {
	await harness?.close();
});

describeReviewRepository(
	"postgres",
	() => ({
		unitOfWork: createPostgresUnitOfWork(db),
		scope: readOnlyScope(db),
		reset: async () => {
			await harness.client.unsafe(
				"truncate pages, quizzes, questions, question_options, term_pairs, review_states, study_settings cascade",
			);
		},
	}),
	{ skip: !available },
);
