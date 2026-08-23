import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { TestContext } from "@tests/fixtures/application.fixture";
import { countRows } from "@tests/integration/sqlite/migrated-database";
import { createSqliteQuizAttemptRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-attempt.repository";
import { QuizAttemptStatus } from "@/domain/quiz-attempt/quiz-attempt";
import {
	type AttemptsHarness,
	createAttemptsHarness,
	USER,
} from "./attempts.fixture";
import {
	NoActiveAttemptError,
	type PauseQuizAttemptUseCase,
	type ResumeQuizAttemptUseCase,
} from "./resume-quiz-attempt";
import type { StartQuizAttemptUseCase } from "./start-quiz-attempt";

let context: TestContext;
let start: StartQuizAttemptUseCase;
let pause: PauseQuizAttemptUseCase;
let resume: ResumeQuizAttemptUseCase;
let seedPublishedSet: AttemptsHarness["seedPublishedSet"];
let questionIdOf: AttemptsHarness["questionIdOf"];

beforeEach(() => {
	({ context, start, pause, resume, seedPublishedSet, questionIdOf } =
		createAttemptsHarness());
});

afterEach(() => {
	context.close();
});

describe("PauseQuizAttemptUseCase and ResumeQuizAttemptUseCase", () => {
	test("pauses and resumes", async () => {
		const quizSetId = await seedPublishedSet();
		const { attemptId } = await start.execute({
			quizSetId,
			telegramUserId: USER,
		});
		context.clock.advance(60_000);

		await pause.execute({ telegramUserId: USER });

		expect(context.attempts.findById(attemptId)?.status).toBe(
			QuizAttemptStatus.Paused,
		);

		context.clock.advance(60_000);
		const resumed = await resume.execute({ telegramUserId: USER });

		expect(context.attempts.findById(attemptId)?.status).toBe(
			QuizAttemptStatus.Active,
		);
		expect(String(resumed.currentQuestionId)).toBe(
			String(questionIdOf(quizSetId, 0)),
		);
	});

	test("pausing twice and resuming twice are no-ops", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);

		await pause.execute({ telegramUserId: USER });
		await pause.execute({ telegramUserId: USER });
		await resume.execute({ telegramUserId: USER });
		await resume.execute({ telegramUserId: USER });

		expect(countRows(context.database, "quiz_attempts")).toBe(1);
	});

	test("a paused attempt survives a restart", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);
		await pause.execute({ telegramUserId: USER });

		const restarted = createSqliteQuizAttemptRepository(
			context.client,
			context.transaction,
		);

		expect(restarted.findActiveByUser(USER)?.status).toBe(
			QuizAttemptStatus.Paused,
		);
	});

	test("both reject a user with nothing unfinished", async () => {
		await expect(pause.execute({ telegramUserId: USER })).rejects.toThrow(
			NoActiveAttemptError,
		);
		await expect(resume.execute({ telegramUserId: USER })).rejects.toThrow(
			NoActiveAttemptError,
		);
	});
});
