import { afterAll, beforeAll } from "bun:test";
import { drizzle } from "drizzle-orm/postgres-js";
import type { RecallDatabase } from "@/persistence/postgres/client";
import * as schema from "@/persistence/postgres/schema";
import {
	createPostgresUnitOfWork,
	readOnlyScope,
} from "@/persistence/postgres/unit-of-work";
import { describePageRepository } from "../../contracts/page.repository.contract";
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

	harness = await openPostgres("pages");
	await applyMigration(harness);
	db = drizzle({ client: harness.client, schema });
});

afterAll(async () => {
	await harness?.close();
});

describePageRepository(
	"postgres",
	() => ({
		unitOfWork: createPostgresUnitOfWork(db),
		scope: readOnlyScope(db),
		reset: async () => {
			await harness.client.unsafe("truncate pages, quizzes cascade");
		},
		seedQuiz: async (pageId, status) => {
			await harness.client`
				insert into quizzes (id, page_id, title, language, status)
				values (
					${crypto.randomUUID()}::uuid, ${pageId}::uuid,
					${status}::text, 'en'::text, ${status}::text
				)
			`;
		},
	}),
	{ skip: !available },
);
