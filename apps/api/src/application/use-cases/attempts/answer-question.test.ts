import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	type MemoryContext,
	responseCount,
} from "@tests/fixtures/memory.fixture";

import {
	QuestionNotInAttemptError,
	QuizAttemptValidationError,
} from "@/domain/quiz-attempt/quiz-attempt.errors";
import {
	type AnswerQuestionUseCase,
	AttemptNotActiveError,
} from "./answer-question";
import {
	type AttemptsHarness,
	createAttemptsHarness,
	USER,
} from "./attempts.fixture";
import {
	NoActiveAttemptError,
	type PauseQuizAttemptUseCase,
} from "./resume-quiz-attempt";
import type { StartQuizAttemptUseCase } from "./start-quiz-attempt";

let context: MemoryContext;
let start: StartQuizAttemptUseCase;
let pause: PauseQuizAttemptUseCase;
let answer: AnswerQuestionUseCase;
let seedPublishedSet: AttemptsHarness["seedPublishedSet"];
let positionOf: AttemptsHarness["positionOf"];
let questionIdOf: AttemptsHarness["questionIdOf"];

beforeEach(() => {
	({
		context,
		start,
		pause,
		answer,
		seedPublishedSet,
		positionOf,
		questionIdOf,
	} = createAttemptsHarness());
});

afterEach(() => {
	context.close();
});

describe("AnswerQuestionUseCase", () => {
	test("records a correct answer and advances", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);

		const result = await answer.execute({
			telegramUserId: USER,
			questionId: await questionIdOf(quizSetId, 0),
			selectedOptionPositions: [await positionOf(quizSetId, 0, true)],
		});

		expect(result.isCorrect).toBe(true);
		expect(result.alreadyAnswered).toBe(false);
		expect(result.explanation).toBe("Because of One");
		expect(result.correctOptionIds).toHaveLength(1);
		expect(String(result.nextQuestionId)).toBe(
			String(await questionIdOf(quizSetId, 1)),
		);
		expect(result.score).toEqual({ correct: 1, total: 2, percentage: 50 });
	});

	test("records a wrong answer and still returns the correct options", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);

		const result = await answer.execute({
			telegramUserId: USER,
			questionId: await questionIdOf(quizSetId, 0),
			selectedOptionPositions: [await positionOf(quizSetId, 0, false)],
		});

		expect(result.isCorrect).toBe(false);
		expect(result.score).toEqual({ correct: 0, total: 2, percentage: 0 });
	});

	test("a replayed callback never scores twice", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);
		const command = {
			telegramUserId: USER,
			questionId: await questionIdOf(quizSetId, 0),
			selectedOptionPositions: [await positionOf(quizSetId, 0, true)],
		};
		await answer.execute(command);

		const replay = await answer.execute(command);

		expect(replay.alreadyAnswered).toBe(true);
		expect(replay.score).toEqual({ correct: 1, total: 2, percentage: 50 });
		expect(String(replay.nextQuestionId)).toBe(
			String(await questionIdOf(quizSetId, 1)),
		);
		expect(responseCount(context.store)).toBe(1);
	});

	test("a replay cannot turn a wrong answer into a right one", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);
		await answer.execute({
			telegramUserId: USER,
			questionId: await questionIdOf(quizSetId, 0),
			selectedOptionPositions: [await positionOf(quizSetId, 0, false)],
		});

		const replay = await answer.execute({
			telegramUserId: USER,
			questionId: await questionIdOf(quizSetId, 0),
			selectedOptionPositions: [await positionOf(quizSetId, 0, true)],
		});

		expect(replay.alreadyAnswered).toBe(true);
		expect(replay.isCorrect).toBe(false);
		expect(replay.score).toEqual({ correct: 0, total: 2, percentage: 0 });
	});

	test("refuses a stale callback for a question that is not current", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);

		await expect(
			answer.execute({
				telegramUserId: USER,
				questionId: await questionIdOf(quizSetId, 1),
				selectedOptionPositions: [await positionOf(quizSetId, 1, true)],
			}),
		).rejects.toThrow(QuestionNotInAttemptError);
		expect(responseCount(context.store)).toBe(0);
	});

	test("refuses an option position the question does not have", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);

		await expect(
			answer.execute({
				telegramUserId: USER,
				questionId: await questionIdOf(quizSetId, 0),
				selectedOptionPositions: [99],
			}),
		).rejects.toThrow(QuizAttemptValidationError);
		expect(responseCount(context.store)).toBe(0);
	});

	test("refuses an empty selection", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);

		await expect(
			answer.execute({
				telegramUserId: USER,
				questionId: await questionIdOf(quizSetId, 0),
				selectedOptionPositions: [],
			}),
		).rejects.toThrow(QuizAttemptValidationError);
	});

	test("refuses while paused", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);
		await pause.execute({ telegramUserId: USER });

		await expect(
			answer.execute({
				telegramUserId: USER,
				questionId: await questionIdOf(quizSetId, 0),
				selectedOptionPositions: [await positionOf(quizSetId, 0, true)],
			}),
		).rejects.toThrow(AttemptNotActiveError);
	});

	test("refuses with no attempt at all", async () => {
		const quizSetId = await seedPublishedSet();

		await expect(
			answer.execute({
				telegramUserId: USER,
				questionId: await questionIdOf(quizSetId, 0),
				selectedOptionPositions: [await positionOf(quizSetId, 0, true)],
			}),
		).rejects.toThrow(NoActiveAttemptError);
	});

	test("the last answer leaves no next question", async () => {
		const quizSetId = await seedPublishedSet(["One"]);
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);

		const result = await answer.execute({
			telegramUserId: USER,
			questionId: await questionIdOf(quizSetId, 0),
			selectedOptionPositions: [await positionOf(quizSetId, 0, true)],
		});

		expect(result.nextQuestionId).toBeUndefined();
	});
});
