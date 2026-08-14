import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	createTestContext,
	type TestContext,
} from "@tests/fixtures/application.fixture";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import { type QuizSetId, toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { AnswerQuestion } from "../attempts/answer-question";
import { FinishQuizAttempt } from "../attempts/finish-quiz-attempt";
import { StartQuizAttempt } from "../attempts/start-quiz-attempt";
import { AddQuestions, type QuestionInput } from "../quiz-sets/add-questions";
import { CreateQuizSet } from "../quiz-sets/create-quiz-set";
import { PublishQuizSet } from "../quiz-sets/publish-quiz-set";
import { QuizSetNotFoundError } from "../quiz-sets/update-quiz-set";
import { GetQuizStatistics } from "./get-quiz-statistics";

const USER = 42;

let context: TestContext;
let create: CreateQuizSet;
let add: AddQuestions;
let publish: PublishQuizSet;
let start: StartQuizAttempt;
let answer: AnswerQuestion;
let finish: FinishQuizAttempt;
let statistics: GetQuizStatistics;

beforeEach(() => {
	context = createTestContext();
	create = new CreateQuizSet(context);
	add = new AddQuestions(context);
	publish = new PublishQuizSet(context);
	start = new StartQuizAttempt(context);
	answer = new AnswerQuestion(context);
	finish = new FinishQuizAttempt(context);
	statistics = new GetQuizStatistics(context);
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

	const questions = context.quizSets.findById(quizSetId)?.questions ?? [];

	for (const [index, question] of questions.entries()) {
		const option = question.options.find(
			(candidate) => candidate.isCorrect === (correct[index] ?? false),
		);

		context.clock.advance(60_000);
		await answer.execute({
			telegramUserId,
			questionId: question.id,
			selectedOptionPositions: [option?.position ?? 0],
		});
	}

	context.clock.advance(60_000);
	await finish.execute({ telegramUserId });
}

describe("GetQuizStatistics", () => {
	test("returns a zero result for a set with no attempts", async () => {
		const quizSetId = await seedPublishedSet([aQuestionInput("One")]);

		expect(
			await statistics.execute({ telegramUserId: USER, quizSetId }),
		).toEqual({
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
			telegramUserId: USER,
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
			(await statistics.execute({ telegramUserId: USER, quizSetId }))
				.improvement,
		).toBeUndefined();
	});

	test("excludes an attempt that is still in progress", async () => {
		const quizSetId = await seedPublishedSet([aQuestionInput("One")]);
		await start.execute({ quizSetId, telegramUserId: USER });

		expect(
			(await statistics.execute({ telegramUserId: USER, quizSetId })).attempts,
		).toEqual([]);
	});

	test("groups accuracy by topic and reports an absent topic once", async () => {
		const quizSetId = await seedPublishedSet([
			aQuestionInput("One", "Alpha"),
			aQuestionInput("Two", "Alpha"),
			aQuestionInput("Three"),
		]);

		await playAttempt(quizSetId, [true, false, true]);

		expect(
			(
				await statistics.execute({ telegramUserId: USER, quizSetId })
			).topics.map((entry) => [entry.topic, entry.answered, entry.correct]),
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
			telegramUserId: USER,
			quizSetId,
		});

		expect(afterMistake.incorrectQuestionIds).toHaveLength(1);

		await playAttempt(quizSetId, [true, true]);

		expect(
			(await statistics.execute({ telegramUserId: USER, quizSetId }))
				.incorrectQuestionIds,
		).toEqual([]);
	});

	test("ignores another user's attempts", async () => {
		const quizSetId = await seedPublishedSet([aQuestionInput("One")]);
		await playAttempt(quizSetId, [true], 7);

		const result = await statistics.execute({
			telegramUserId: USER,
			quizSetId,
		});

		expect(result.attempts).toEqual([]);
		expect(result.topics).toEqual([]);
	});

	test("rejects an unknown set", async () => {
		await expect(
			statistics.execute({
				telegramUserId: USER,
				quizSetId: toQuizSetId("missing"),
			}),
		).rejects.toThrow(QuizSetNotFoundError);
	});
});
