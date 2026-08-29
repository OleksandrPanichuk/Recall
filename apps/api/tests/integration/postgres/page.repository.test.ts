import { afterAll, beforeAll } from "bun:test";
import { drizzle } from "drizzle-orm/postgres-js";
import type { OwnerId } from "@/application/ports/owner";
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
	seedOwner,
} from "../../fixtures/postgres";

const available = await postgresAvailable();

let harness: PostgresHarness;
let db: RecallDatabase;
let owner: OwnerId;

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("pages");
	await applyMigration(harness);
	db = drizzle({ client: harness.client, schema });
	owner = await seedOwner(harness, `${"page"} owner`);
});

afterAll(async () => {
	await harness?.close();
});

describePageRepository(
	"postgres",
	() => ({
		unitOfWork: createPostgresUnitOfWork(db, owner),
		scope: readOnlyScope(db, owner),
		reset: async () => {
			await harness.client.unsafe("truncate pages, quizzes cascade");
		},
		seedQuiz: async (pageId, status) => {
			const id = crypto.randomUUID();

			await harness.client`
				insert into quizzes (id, owner_id, page_id, title, language, status)
				values (
					${id}::uuid, ${String(owner)}::text, ${pageId}::uuid,
					${status}::text, 'en'::text, ${status}::text
				)
			`;

			return id;
		},
	}),
	{ skip: !available },
);
