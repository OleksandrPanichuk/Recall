import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	type AttemptsHarness,
	createAttemptsHarness,
	USER,
} from "@tests/fixtures/attempts.fixture";
import { attemptsOver } from "@tests/fixtures/attempts.use-cases";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import {
	aQuestionInput as aPracticeQuestion,
	createPracticeHarness,
} from "@tests/fixtures/practice.fixture";
import { QuizAttemptMode, QuizAttemptStatus } from "@/modules/attempts";
import { RecallGrade } from "@/modules/scheduling";
import { StudySettingsEntity } from "@/modules/study-settings";
import type { AnswerQuestionUseCase } from "./answer-question";
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

const chooseFsrs = async (): Promise<void> => {
	await context.scope.reviews.saveSettings(
		{ kind: "owner" },
		StudySettingsEntity.withRepetition(StudySettingsEntity.defaults(), {
			...StudySettingsEntity.defaults().repetition,
			scheduler: "fsrs",
		}),
	);
};

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

describe("what finishing tells the learner about the schedule", () => {
	test("a full attempt lists every answered question with its grade and due date", async () => {
		const quizSetId = await seedPublishedSet(["One", "Two"]);
		await start.execute({ quizSetId });
		await answer.execute({
			questionId: await questionIdOf(quizSetId, 0),
			selectedOptionPositions: [await positionOf(quizSetId, 0, true)],
		});
		await answer.execute({
			questionId: await questionIdOf(quizSetId, 1),
			selectedOptionPositions: [await positionOf(quizSetId, 1, false)],
		});

		const result = await finish.execute({});

		expect(result.mode).toBe(QuizAttemptMode.Full);
		expect(result.scheduled).toHaveLength(2);
		expect(result.scheduled[0]).toMatchObject({
			questionId: await questionIdOf(quizSetId, 0),
			prompt: "One",
			grade: RecallGrade.Good,
		});
		expect(result.scheduled[1]).toMatchObject({
			questionId: await questionIdOf(quizSetId, 1),
			prompt: "Two",
			grade: RecallGrade.Again,
		});
		for (const entry of result.scheduled) {
			expect(entry.dueAt).toBeInstanceOf(Date);
			expect(entry.dueAt?.getTime()).toBeGreaterThan(
				context.clock.now().getTime(),
			);
		}
	});

	test("an attempt with no answers schedules nothing", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId });

		const result = await finish.execute({});

		expect(result.scheduled).toEqual([]);
	});

	test("a rated answer carries the felt grade under fsrs", async () => {
		await chooseFsrs();
		const rate = attemptsOver(context).rateRecall;
		const quizSetId = await seedPublishedSet(["One"]);
		await start.execute({ quizSetId });
		await answer.execute({
			questionId: await questionIdOf(quizSetId, 0),
			selectedOptionPositions: [await positionOf(quizSetId, 0, true)],
		});
		await rate.execute({
			questionId: await questionIdOf(quizSetId, 0),
			recall: RecallGrade.Hard,
		});

		const result = await finish.execute({});

		expect(result.scheduled).toHaveLength(1);
		expect(result.scheduled[0]?.grade).toBe(RecallGrade.Hard);
		expect(result.scheduled[0]?.dueAt).toBeInstanceOf(Date);
	});

	test("a mistakes attempt reports its mode and schedules nothing", async () => {
		const practice = createPracticeHarness();
		const quizSetId = await practice.seedPublishedSet([
			aPracticeQuestion("One"),
			aPracticeQuestion("Two"),
		]);
		await practice.playAttempt(quizSetId, [true, false]);
		await practice.practice.execute({
			quizSetId,
			mode: QuizAttemptMode.Mistakes,
		});
		await practice.answerCurrent(true);

		const result = await practice.finish.execute({});

		expect(result.mode).toBe(QuizAttemptMode.Mistakes);
		expect(result.scheduled).toEqual([]);
		practice.context.close();
	});
});
