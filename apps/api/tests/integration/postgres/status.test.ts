import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createMutableClock } from "@tests/fixtures/memory.fixture";
import {
	type Application,
	createApplication,
} from "@/composition/create-application";
import { QuizAttemptStatus } from "@/domain/quiz-attempt/quiz-attempt";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import { readStatus } from "@/infrastructure/lifecycle/status";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
} from "../../fixtures/postgres";

const available = await postgresAvailable();
const USER = 42;

let harness: PostgresHarness;
let databaseUrl: string;

const clock = createMutableClock();

const open = (): Application => createApplication({ databaseUrl, clock });

const aQuestion = (prompt: string) => ({
	type: QuestionType.SingleChoice,
	prompt,
	difficulty: Difficulty.Medium,
	options: [
		{ text: `Right for ${prompt}`, isCorrect: true },
		{ text: `Wrong for ${prompt}`, isCorrect: false },
	],
});

const seed = async (application: Application): Promise<QuizSetId> => {
	const { quizSetId } = await application.createQuizSet.execute({
		title: "Bun persistence",
		language: "uk",
	});

	await application.addQuestions.execute({
		quizSetId,
		questions: [aQuestion("One"), aQuestion("Two")],
	});
	await application.publishQuizSet.execute({ quizSetId });

	return quizSetId;
};

const startAndAnswerOne = async (
	application: Application,
	quizSetId: QuizSetId,
): Promise<void> => {
	await application.startQuizAttempt.execute({
		quizSetId,
		telegramUserId: USER,
	});

	const [question] = (await application.getQuizSet.execute({ quizSetId }))
		.questions;

	clock.advance(60_000);
	await application.answerQuestion.execute({
		telegramUserId: USER,
		questionId: question?.id as never,
		selectedOptionPositions: [0],
	});
};

const truncate = async (): Promise<void> => {
	await harness.client.unsafe(
		"truncate pages, quizzes, questions, question_options, attempts, attempt_questions, responses cascade",
	);
};

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("status");
	await applyMigration(harness);
	databaseUrl = harness.url;
});

afterAll(async () => {
	await harness?.close();
});

describe.skipIf(!available)("the status report", () => {
	test("counts what is in the database without reading content", async () => {
		const application = open();

		try {
			await truncate();

			const quizSetId = await seed(application);

			await startAndAnswerOne(application, quizSetId);

			const report = await readStatus(application.connection.db, {
				databaseUrl,
				timezone: "Europe/Kyiv",
			});

			expect(report).toEqual({
				databaseUrl,
				timezone: "Europe/Kyiv",
				publishedSets: 1,
				draftSets: 0,
				questions: 2,
				completedAttempts: 0,
				unfinishedAttempts: 1,
				answeredQuestions: 1,
			});
		} finally {
			await application.close();
		}
	});

	test("reports zeroes for an empty database", async () => {
		const application = open();

		try {
			await truncate();

			const report = await readStatus(application.connection.db, {
				databaseUrl,
				timezone: "UTC",
			});

			expect(report.publishedSets).toBe(0);
			expect(report.questions).toBe(0);
			expect(report.unfinishedAttempts).toBe(0);
		} finally {
			await application.close();
		}
	});

	test("an unfinished attempt survives closing and reopening the connection", async () => {
		const first = open();
		let quizSetId: QuizSetId;

		try {
			await truncate();
			quizSetId = await seed(first);
			await startAndAnswerOne(first, quizSetId);
			clock.advance(60_000);
			await first.pauseQuizAttempt.execute({ telegramUserId: USER });
		} finally {
			await first.close();
		}

		const second = open();

		try {
			const current = await second.getCurrentQuestion.execute({
				telegramUserId: USER,
			});

			expect(current?.index).toBe(1);
			expect(current?.status).toBe(QuizAttemptStatus.Paused);

			clock.advance(60_000);
			await second.resumeQuizAttempt.execute({ telegramUserId: USER });
			clock.advance(60_000);

			const finished = await second.finishQuizAttempt.execute({
				telegramUserId: USER,
			});

			expect(finished.score.correct).toBe(1);
		} finally {
			await second.close();
		}
	});
});
