import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import { QuizAttemptStatus } from "@/domain/quiz-attempt/quiz-attempt";
import type { AnswerQuestionUseCase } from "./answer-question";
import {
	type AttemptsHarness,
	createAttemptsHarness,
	USER,
} from "./attempts.fixture";
import type { FinishQuizAttemptUseCase } from "./finish-quiz-attempt";
import {
	NoActiveAttemptError,
	type PauseQuizAttemptUseCase,
} from "./resume-quiz-attempt";
import type { StartQuizAttemptUseCase } from "./start-quiz-attempt";

let context: MemoryContext;
let start: StartQuizAttemptUseCase;
let pause: PauseQuizAttemptUseCase;
let answer: AnswerQuestionUseCase;
let finish: FinishQuizAttemptUseCase;
let seedPublishedSet: AttemptsHarness["seedPublishedSet"];
let positionOf: AttemptsHarness["positionOf"];
let questionIdOf: AttemptsHarness["questionIdOf"];

beforeEach(() => {
	({
		context,
		start,
		pause,
		answer,
		finish,
		seedPublishedSet,
		positionOf,
		questionIdOf,
	} = createAttemptsHarness());
});

afterEach(() => {
	context.close();
});

describe("FinishQuizAttemptUseCase", () => {
	test("completes a partially answered attempt", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);
		await answer.execute({
			questionId: await questionIdOf(quizSetId, 0),
			selectedOptionPositions: [await positionOf(quizSetId, 0, true)],
		});
		context.clock.advance(60_000);

		const result = await finish.execute({});

		expect(result.unansweredCount).toBe(1);
		expect(result.score).toEqual({ correct: 1, total: 2, percentage: 50 });
		expect(
			(await context.scope.attempts.findById(result.attemptId))?.status,
		).toBe(QuizAttemptStatus.Completed);
		expect(await context.scope.attempts.findActive()).toBeUndefined();
		expect(
			await context.scope.attempts.listCompletedForQuiz(quizSetId),
		).toHaveLength(1);
	});

	test("completes a paused attempt", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);
		await pause.execute({});
		context.clock.advance(60_000);

		const result = await finish.execute({});

		expect(
			(await context.scope.attempts.findById(result.attemptId))?.status,
		).toBe(QuizAttemptStatus.Completed);
	});

	test("a second call has nothing to finish", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);
		await finish.execute({});

		await expect(finish.execute({})).rejects.toThrow(NoActiveAttemptError);
	});
});
