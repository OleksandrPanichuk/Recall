import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { attemptsOver } from "@tests/fixtures/attempts.use-cases";
import {
	createMemoryContext,
	type MemoryContext,
} from "@tests/fixtures/memory.fixture";
import { quizzesOver } from "@tests/fixtures/quizzes.use-cases";
import {
	AnswerQuestionUseCase,
	FinishQuizAttemptUseCase,
	StartQuizAttemptUseCase,
} from "@/modules/attempts";
import {
	AddQuestionsUseCase,
	CreateQuizSetUseCase,
	Difficulty,
	PublishQuizSetUseCase,
	type QuestionInput,
	QuestionType,
	type QuizSetId,
	QuizSetNotFoundError,
	toQuizSetId,
} from "@/modules/quizzes";
import { GetQuizStatisticsUseCase } from "./get-quiz-statistics";

const USER = 42;

let context: MemoryContext;
let create: CreateQuizSetUseCase;
let add: AddQuestionsUseCase;
let publish: PublishQuizSetUseCase;
let start: StartQuizAttemptUseCase;
let answer: AnswerQuestionUseCase;
let finish: FinishQuizAttemptUseCase;
let statistics: GetQuizStatisticsUseCase;

beforeEach(() => {
	context = createMemoryContext();
	create = quizzesOver(context).createQuizSet;
	add = quizzesOver(context).addQuestions;
	publish = quizzesOver(context).publishQuizSet;
	start = attemptsOver(context).startQuizAttempt;
	answer = attemptsOver(context).answerQuestion;
	finish = attemptsOver(context).finishQuizAttempt;
	statistics = new GetQuizStatisticsUseCase(
		context.scope.attempts,
		context.scope.quizzes,
	);
});

afterEach(() => {
	context.close();
});

const aQuestionInput = (prompt: string, topic?: string): QuestionInput => ({
	type: QuestionType.SingleChoice,
	prompt,
	difficulty: Difficulty.Medium,
	topic,
	options: [
		{ text: `Right for ${prompt}`, isCorrect: true },
		{ text: `Wrong for ${prompt}`, isCorrect: false },
	],
});

async function seedPublishedSet(
	questions: readonly QuestionInput[],
): Promise<QuizSetId> {
	const { quizSetId } = await create.execute({
		title: "Bun persistence",
		language: "uk",
	});

	await add.execute({ quizSetId, questions });
	await publish.execute({ quizSetId });

	return quizSetId;
}

async function playAttempt(
	quizSetId: QuizSetId,
	correct: readonly boolean[],
	telegramUserId = USER,
): Promise<void> {
	await start.execute({ quizSetId, telegramUserId });

	const questions =
		(await context.scope.quizzes.findById(quizSetId))?.questions ?? [];

	for (const [index, question] of questions.entries()) {
		const option = question.options.find(
			(candidate) => candidate.isCorrect === (correct[index] ?? false),
		);

		context.clock.advance(60_000);
		await answer.execute({
			questionId: question.id,
			selectedOptionPositions: [option?.position ?? 0],
		});
	}

	context.clock.advance(60_000);
	await finish.execute({});
}

describe("GetQuizStatisticsUseCase", () => {
	test("returns a zero result for a set with no attempts", async () => {
		const quizSetId = await seedPublishedSet([aQuestionInput("One")]);

		expect(await statistics.execute({ quizSetId })).toEqual({
			quizSetId,
			title: "Bun persistence",
			folderId: undefined,
			attempts: [],
			setAccuracy: { correct: 0, total: 0, percentage: 0 },
			topics: [],
			incorrectQuestionIds: [],
			improvement: undefined,
		});
	});

	test("summarises repeated attempts oldest first and reports improvement", async () => {
		const quizSetId = await seedPublishedSet([
			aQuestionInput("One"),
			aQuestionInput("Two"),
		]);

		await playAttempt(quizSetId, [true, false]);
		await playAttempt(quizSetId, [true, false]);
		await playAttempt(quizSetId, [true, true]);

		const result = await statistics.execute({
			quizSetId,
		});

		expect(result.attempts.map((entry) => entry.score.percentage)).toEqual([
			50, 50, 100,
		]);
		expect(result.setAccuracy).toEqual({
			correct: 4,
			total: 6,
			percentage: 66.7,
		});
		expect(result.improvement).toEqual({
			firstPercentage: 50,
			lastPercentage: 100,
			deltaPercentage: 50,
		});
	});

	test("leaves improvement undefined after a single attempt", async () => {
		const quizSetId = await seedPublishedSet([aQuestionInput("One")]);

		await playAttempt(quizSetId, [true]);

		expect(
			(await statistics.execute({ quizSetId })).improvement,
		).toBeUndefined();
	});

	test("excludes an attempt that is still in progress", async () => {
		const quizSetId = await seedPublishedSet([aQuestionInput("One")]);
		await start.execute({ quizSetId, telegramUserId: USER });

		expect((await statistics.execute({ quizSetId })).attempts).toEqual([]);
	});

	test("groups accuracy by topic and reports an absent topic once", async () => {
		const quizSetId = await seedPublishedSet([
			aQuestionInput("One", "Alpha"),
			aQuestionInput("Two", "Alpha"),
			aQuestionInput("Three"),
		]);

		await playAttempt(quizSetId, [true, false, true]);

		expect(
			(await statistics.execute({ quizSetId })).topics.map((entry) => [
				entry.topic,
				entry.answered,
				entry.correct,
			]),
		).toEqual([
			["Alpha", 2, 1],
			[undefined, 1, 1],
		]);
	});

	test("lists outstanding mistakes and drops them once answered correctly", async () => {
		const quizSetId = await seedPublishedSet([
			aQuestionInput("One"),
			aQuestionInput("Two"),
		]);

		await playAttempt(quizSetId, [true, false]);

		const afterMistake = await statistics.execute({
			quizSetId,
		});

		expect(afterMistake.incorrectQuestionIds).toHaveLength(1);

		await playAttempt(quizSetId, [true, true]);

		expect(
			(await statistics.execute({ quizSetId })).incorrectQuestionIds,
		).toEqual([]);
	});

	test("ignores another set's topics and mistakes", async () => {
		const studied = await seedPublishedSet([aQuestionInput("One", "Alpha")]);
		const other = await seedPublishedSet([aQuestionInput("Two", "Beta")]);

		await playAttempt(studied, [true]);
		await playAttempt(other, [false]);

		const result = await statistics.execute({
			quizSetId: studied,
		});

		expect(result.topics.map((entry) => entry.topic)).toEqual(["Alpha"]);
		expect(result.incorrectQuestionIds).toEqual([]);
	});

	test("counts every attempt the owner made, whichever client made it", async () => {
		const quizSetId = await seedPublishedSet([aQuestionInput("One")]);

		await playAttempt(quizSetId, [true], 7);

		const result = await statistics.execute({ quizSetId });

		expect(result.attempts).toHaveLength(1);
	});

	test("rejects an unknown set", async () => {
		await expect(
			statistics.execute({
				quizSetId: toQuizSetId("missing"),
			}),
		).rejects.toThrow(QuizSetNotFoundError);
	});
});
