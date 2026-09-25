import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	createPostgresUnitOfWork,
	readOnlyScope,
} from "@tests/fixtures/postgres-scope";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { OwnerId } from "@/core/owner";
import type { RecallDatabase } from "@/db/client";
import * as schema from "@/db/schema";
import {
	AttemptEntity,
	QuizAttemptMode,
	toQuizAttemptId,
} from "@/modules/attempts";
import {
	createQuestion,
	Difficulty,
	QuestionType,
	QuizSetEntity,
	toQuestionId,
	toQuestionOptionId,
	toQuizSetId,
} from "@/modules/quizzes";
import { describeAttemptRepository } from "../../contracts/attempt.repository.contract";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
	seedOwner,
} from "../../fixtures/postgres";

const available = await postgresAvailable();

let harness: PostgresHarness;
let pool: postgres.Sql;
let db: RecallDatabase;
let owner: OwnerId;

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("attempts");
	await applyMigration(harness);
	pool = postgres(harness.url, { max: 4, prepare: false, onnotice: () => {} });
	db = drizzle({ client: pool, schema });
	owner = await seedOwner(harness, `${"attempt"} owner`);
});

afterAll(async () => {
	await pool?.end({ timeout: 5 });
	await harness?.close();
});

describeAttemptRepository(
	"postgres",
	() => ({
		unitOfWork: createPostgresUnitOfWork(db, owner),
		scope: readOnlyScope(db, owner),
		reset: async () => {
			await harness.client.unsafe(
				"truncate pages, quizzes, questions, question_options, attempts, attempt_questions, responses cascade",
			);
		},
	}),
	{ skip: !available },
);

const physical = async (
	table: "attempt_questions" | "responses",
	attemptId: string,
): Promise<readonly string[]> =>
	(
		await harness.client.unsafe<{ ctid: string }[]>(
			`select ctid::text as ctid from ${table} where attempt_id = $1::uuid order by question_id`,
			[attemptId],
		)
	).map((row) => row.ctid);

describe.skipIf(!available)("what answering writes", () => {
	test("an answer adds its own row and leaves the plan and earlier answers untouched", async () => {
		const at = new Date("2026-08-01T10:00:00.000Z");
		const quiz = QuizSetEntity.addQuestions(
			QuizSetEntity.create({
				id: toQuizSetId(crypto.randomUUID()),
				title: "Writes",
				language: "en",
				createdAt: at,
			}),
			["One?", "Two?", "Three?"].map((prompt, position) =>
				createQuestion({
					id: toQuestionId(crypto.randomUUID()),
					type: QuestionType.SingleChoice,
					prompt,
					difficulty: Difficulty.Medium,
					position,
					options: [
						{
							id: toQuestionOptionId(crypto.randomUUID()),
							text: "Right",
							isCorrect: true,
							position: 0,
						},
						{
							id: toQuestionOptionId(crypto.randomUUID()),
							text: "Wrong",
							isCorrect: false,
							position: 1,
						},
					],
				}),
			),
			at,
		);
		const unitOfWork = createPostgresUnitOfWork(db, owner);
		const save = (attempt: AttemptEntity) =>
			unitOfWork.run(({ attempts }) => attempts.save(attempt));
		const answer = (attempt: AttemptEntity, index: number) => {
			const question = quiz.questions[index] as (typeof quiz.questions)[number];

			return AttemptEntity.recordResponse(attempt, {
				questionId: question.id,
				selectedOptionIds: question.options.slice(0, 1).map(({ id }) => id),
				isCorrect: true,
				answeredAt: new Date(at.getTime() + (index + 1) * 60_000),
			});
		};

		await unitOfWork.run(({ quizzes }) => quizzes.save(quiz));

		const begun = AttemptEntity.start({
			id: toQuizAttemptId(crypto.randomUUID()),
			quizSetId: quiz.id,
			mode: QuizAttemptMode.Full,
			questionIds: quiz.questions.map(({ id }) => id),
			startedAt: at,
		});
		const once = answer(begun, 0);

		await save(begun);
		await save(once);

		const plan = await physical("attempt_questions", String(begun.id));
		const [first] = await physical("responses", String(begun.id));

		await save(answer(once, 1));

		expect(await physical("attempt_questions", String(begun.id))).toEqual(plan);
		expect(await physical("responses", String(begun.id))).toHaveLength(2);
		expect(await physical("responses", String(begun.id))).toContain(
			first as string,
		);
	});
});
