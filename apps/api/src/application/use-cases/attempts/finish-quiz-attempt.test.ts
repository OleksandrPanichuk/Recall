import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import { QuizAttemptStatus } from "@/domain/quiz-attempt/quiz-attempt";
import {
	defaultQuizSettings,
	withRepetition,
} from "@/domain/settings/quiz-settings";
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

describe("what finishing writes into the review schedule", () => {
	const chooseFsrs = async (): Promise<void> => {
		await context.scope.reviews.saveSettings(
			{ kind: "owner" },
			withRepetition(defaultQuizSettings(), {
				...defaultQuizSettings().repetition,
				scheduler: "fsrs",
			}),
		);
	};

	const playThrough = async (correct: boolean) => {
		const quizSetId = await seedPublishedSet(["One"]);

		await start.execute({ quizSetId });
		await answer.execute({
			questionId: await questionIdOf(quizSetId, 0),
			selectedOptionPositions: [await positionOf(quizSetId, 0, correct)],
		});
		await finish.execute({});

		return context.scope.reviews.findSchedules([
			await questionIdOf(quizSetId, 0),
		]);
	};

	test("the ladder leaves memory state alone", async () => {
		const [schedule] = await playThrough(true);

		expect(schedule?.dueAt).toBeDefined();
		expect(schedule?.stability).toBeUndefined();
	});

	test("fsrs writes the stability and difficulty it computed", async () => {
		await chooseFsrs();

		const [schedule] = await playThrough(true);

		expect(schedule?.stability).toBeGreaterThan(0);
		expect(schedule?.difficulty).toBeGreaterThan(0);
		expect(schedule?.dueAt).toBeDefined();
	});

	test("under fsrs a first wrong answer is not yet a lapse", async () => {
		await chooseFsrs();

		const [schedule] = await playThrough(false);

		expect(schedule?.lapses).toBe(0);
		expect(schedule?.stability).toBeGreaterThan(0);
	});

	test("under the ladder the same first wrong answer counts as one", async () => {
		const [schedule] = await playThrough(false);

		expect(schedule?.lapses).toBe(1);
	});
});
