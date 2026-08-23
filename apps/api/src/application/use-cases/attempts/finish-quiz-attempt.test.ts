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
			telegramUserId: USER,
			questionId: questionIdOf(quizSetId, 0),
			selectedOptionPositions: [positionOf(quizSetId, 0, true)],
		});
		context.clock.advance(60_000);

		const result = await finish.execute({ telegramUserId: USER });

		expect(result.unansweredCount).toBe(1);
		expect(result.score).toEqual({ correct: 1, total: 2, percentage: 50 });
		expect(context.attempts.findById(result.attemptId)?.status).toBe(
			QuizAttemptStatus.Completed,
		);
		expect(context.attempts.findActiveByUser(USER)).toBeUndefined();
		expect(context.attempts.listCompletedBySet(USER, quizSetId)).toHaveLength(
			1,
		);
	});

	test("completes a paused attempt", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);
		await pause.execute({ telegramUserId: USER });
		context.clock.advance(60_000);

		const result = await finish.execute({ telegramUserId: USER });

		expect(context.attempts.findById(result.attemptId)?.status).toBe(
			QuizAttemptStatus.Completed,
		);
	});

	test("a second call has nothing to finish", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);
		await finish.execute({ telegramUserId: USER });

		await expect(finish.execute({ telegramUserId: USER })).rejects.toThrow(
			NoActiveAttemptError,
		);
	});
});
