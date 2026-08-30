import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	attemptCount,
	type MemoryContext,
} from "@tests/fixtures/memory.fixture";
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

let context: MemoryContext;
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
		});
		context.clock.advance(60_000);

		await pause.execute({});

		expect((await context.scope.attempts.findById(attemptId))?.status).toBe(
			QuizAttemptStatus.Paused,
		);

		context.clock.advance(60_000);
		const resumed = await resume.execute({});

		expect((await context.scope.attempts.findById(attemptId))?.status).toBe(
			QuizAttemptStatus.Active,
		);
		expect(String(resumed.currentQuestionId)).toBe(
			String(await questionIdOf(quizSetId, 0)),
		);
	});

	test("pausing twice and resuming twice are no-ops", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);

		await pause.execute({});
		await pause.execute({});
		await resume.execute({});
		await resume.execute({});

		expect(attemptCount(context.store)).toBe(1);
	});

	test("both reject a user with nothing unfinished", async () => {
		await expect(pause.execute({})).rejects.toThrow(NoActiveAttemptError);
		await expect(resume.execute({})).rejects.toThrow(NoActiveAttemptError);
	});
});
