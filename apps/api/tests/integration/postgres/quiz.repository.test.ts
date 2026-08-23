import { afterAll, beforeAll } from "bun:test";
import { drizzle } from "drizzle-orm/postgres-js";
import type { RecallDatabase } from "@/persistence/postgres/client";
import * as schema from "@/persistence/postgres/schema";
import {
	createPostgresUnitOfWork,
	readOnlyScope,
} from "@/persistence/postgres/unit-of-work";
import { describeQuizRepository } from "../../contracts/quiz.repository.contract";
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

	harness = await openPostgres("quizzes");
	await applyMigration(harness);
	db = drizzle({ client: harness.client, schema });
});

afterAll(async () => {
	await harness?.close();
});

describeQuizRepository(
	"postgres",
	() => ({
		unitOfWork: createPostgresUnitOfWork(db),
		scope: readOnlyScope(db),
		reset: async () => {
			await harness.client.unsafe(
				"truncate pages, quizzes, questions, question_options, attempts, responses cascade",
			);
		},
		markAnswered: async (questionId) => {
			const [question] = await harness.client<{ quiz_id: string }[]>`
				select quiz_id::text as quiz_id from questions where id = ${questionId}::uuid
			`;

			if (question === undefined) {
				throw new Error(`no question ${questionId} to answer`);
			}

			const attemptId = crypto.randomUUID();

			await harness.client`
				insert into attempts (id, quiz_id, mode, status, started_at)
				values (
					${attemptId}::uuid, ${question.quiz_id}::uuid,
					'full'::text, 'completed'::text, now()
				)
			`;
			await harness.client`
				insert into responses (attempt_id, question_id, selected_option_ids, is_correct, answered_at)
				values (
					${attemptId}::uuid, ${questionId}::uuid,
					'{}'::uuid[], true, now()
				)
			`;
		},
	}),
	{ skip: !available },
);
