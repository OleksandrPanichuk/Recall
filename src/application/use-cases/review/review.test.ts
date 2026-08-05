import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	createTestContext,
	type TestContext,
} from "@tests/fixtures/application.fixture";
import { QuizAttemptMode } from "@/domain/quiz-attempt/quiz-attempt";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import { ReviewItemState } from "@/domain/review/review-item";
import { ReviewRating } from "@/domain/review/review-schedule";
import { AnswerQuestion } from "../attempts/answer-question";
import { FinishQuizAttempt } from "../attempts/finish-quiz-attempt";
import { StartQuizAttempt } from "../attempts/start-quiz-attempt";
import { AddQuestions, type QuestionInput } from "../quiz-sets/add-questions";
import { CreateQuizSet } from "../quiz-sets/create-quiz-set";
import { PublishQuizSet } from "../quiz-sets/publish-quiz-set";
import { NoReviewItemError, RateReview } from "./rate-review";
import {
	NothingToReviewError,
	StartReviewSession,
} from "./start-review-session";

const USER = 42;

let context: TestContext;
let create: CreateQuizSet;
let add: AddQuestions;
let publish: PublishQuizSet;
let start: StartQuizAttempt;
let answer: AnswerQuestion;
let finish: FinishQuizAttempt;
let session: StartReviewSession;
let rate: RateReview;

beforeEach(() => {
	context = createTestContext();
	create = new CreateQuizSet(context);
	add = new AddQuestions(context);
	publish = new PublishQuizSet(context);
	start = new StartQuizAttempt(context);
	answer = new AnswerQuestion(context);
	finish = new FinishQuizAttempt(context);
	session = new StartReviewSession(context);
	rate = new RateReview(context);
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

async function seedSet(
	title: string,
	questions: readonly QuestionInput[],
): Promise<QuizSetId> {
	const { quizSetId } = await create.execute({ title, language: "uk" });

	await add.execute({ quizSetId, questions });
	await publish.execute({ quizSetId });

	return quizSetId;
}

const questionsOf = (quizSetId: QuizSetId) =>
	context.quizSets.findById(quizSetId)?.questions ?? [];

/** Plays a whole attempt, answering question i correctly iff correct[i]. */
async function play(
	quizSetId: QuizSetId,
	correct: readonly boolean[],
): Promise<void> {
	await start.execute({ quizSetId, telegramUserId: USER });

	for (const [index, question] of questionsOf(quizSetId).entries()) {
		const option = question.options.find(
			(candidate) => candidate.isCorrect === (correct[index] ?? false),
		);

		context.clock.advance(60_000);
		await answer.execute({
			telegramUserId: USER,
			questionId: question.id,
			selectedOptionPositions: [option?.position ?? 0],
		});
	}

	context.clock.advance(60_000);
	await finish.execute({ telegramUserId: USER });
}

describe("mistake queueing (§5.1)", () => {
	test("a wrong answer queues the question", async () => {
		const quizSetId = await seedSet("Bun", [aQuestionInput("One")]);

		await play(quizSetId, [false]);

		const item = context.reviews.findByQuestion(
			USER,
			questionsOf(quizSetId)[0]?.id as never,
		);

		expect(item?.state).toBe(ReviewItemState.Pending);
		expect(item?.streak).toBe(0);
	});

	test("a correct answer queues nothing", async () => {
		const quizSetId = await seedSet("Bun", [aQuestionInput("One")]);

		await play(quizSetId, [true]);

		expect(context.reviews.countPending(USER)).toBe(0);
	});

	// §5.1 gate: one question never grows more than one queue entry.
	test("repeated mistakes never duplicate the queue entry", async () => {
		const quizSetId = await seedSet("Bun", [aQuestionInput("One")]);

		await play(quizSetId, [false]);
		await play(quizSetId, [false]);
		await play(quizSetId, [false]);

		expect(context.reviews.countPending(USER)).toBe(1);
	});

	test("answering it right advances the streak", async () => {
		const quizSetId = await seedSet("Bun", [aQuestionInput("One")]);
		await play(quizSetId, [false]);

		await play(quizSetId, [true]);

		const item = context.reviews.findByQuestion(
			USER,
			questionsOf(quizSetId)[0]?.id as never,
		);

		expect(item?.state).toBe(ReviewItemState.Learning);
		expect(item?.streak).toBe(1);
	});

	test("getting it wrong again resets the streak", async () => {
		const quizSetId = await seedSet("Bun", [aQuestionInput("One")]);
		await play(quizSetId, [false]);
		await play(quizSetId, [true]);

		await play(quizSetId, [false]);

		expect(
			context.reviews.findByQuestion(
				USER,
				questionsOf(quizSetId)[0]?.id as never,
			)?.streak,
		).toBe(0);
	});

	test("a retired question comes back when it is missed again", async () => {
		const quizSetId = await seedSet("Bun", [aQuestionInput("One")]);
		await play(quizSetId, [false]);

		for (let pass = 0; pass < 4; pass += 1) {
			await play(quizSetId, [true]);
		}

		const questionId = questionsOf(quizSetId)[0]?.id as never;

		expect(context.reviews.findByQuestion(USER, questionId)?.state).toBe(
			ReviewItemState.Retired,
		);

		await play(quizSetId, [false]);

		expect(context.reviews.findByQuestion(USER, questionId)?.state).toBe(
			ReviewItemState.Pending,
		);
	});

	test("another user's queue is untouched", async () => {
		const quizSetId = await seedSet("Bun", [aQuestionInput("One")]);

		await play(quizSetId, [false]);

		expect(context.reviews.countPending(7)).toBe(0);
	});
});

describe("mistakes session (§5.1)", () => {
	test("builds a session from due questions", async () => {
		const quizSetId = await seedSet("Bun", [
			aQuestionInput("One"),
			aQuestionInput("Two"),
		]);
		await play(quizSetId, [false, true]);
		// Due the next local morning.
		context.clock.advance(2 * 24 * 60 * 60 * 1000);

		const result = await session.execute({
			telegramUserId: USER,
			mode: QuizAttemptMode.Mistakes,
		});

		expect(result.questionCount).toBe(1);
		expect(context.attempts.findById(result.attemptId)?.mode).toBe(
			QuizAttemptMode.Mistakes,
		);
	});

	test("refuses when nothing is due yet", async () => {
		const quizSetId = await seedSet("Bun", [aQuestionInput("One")]);
		await play(quizSetId, [false]);

		await expect(
			session.execute({
				telegramUserId: USER,
				mode: QuizAttemptMode.Mistakes,
			}),
		).rejects.toThrow(NothingToReviewError);
	});

	test("refuses when there are no mistakes at all", async () => {
		await seedSet("Bun", [aQuestionInput("One")]);

		await expect(
			session.execute({
				telegramUserId: USER,
				mode: QuizAttemptMode.Mistakes,
			}),
		).rejects.toThrow(NothingToReviewError);
	});
});

describe("weak-topic session (§5.2)", () => {
	const topical = async (): Promise<QuizSetId> =>
		seedSet("Bun", [
			aQuestionInput("A1", "Alpha"),
			aQuestionInput("A2", "Alpha"),
			aQuestionInput("A3", "Alpha"),
			aQuestionInput("B1", "Beta"),
			aQuestionInput("B2", "Beta"),
			aQuestionInput("B3", "Beta"),
		]);

	test("picks the topic with the lowest accuracy", async () => {
		const quizSetId = await topical();
		// Alpha 1/3, Beta 3/3.
		await play(quizSetId, [true, false, false, true, true, true]);

		const result = await session.execute({
			telegramUserId: USER,
			mode: QuizAttemptMode.WeakTopics,
		});

		expect(result.topic).toBe("Alpha");
		expect(result.questionCount).toBe(3);
	});

	test("is deterministic when two topics tie", async () => {
		const quizSetId = await topical();
		// Both topics land on 1/3, so the lower topic name wins, every time.
		await play(quizSetId, [true, false, false, true, false, false]);

		for (let run = 0; run < 3; run += 1) {
			const result = await session.execute({
				telegramUserId: USER,
				mode: QuizAttemptMode.WeakTopics,
			});

			expect(result.topic).toBe("Alpha");
			await finish.execute({ telegramUserId: USER });
		}
	});

	test("ignores topics with too little history", async () => {
		const quizSetId = await seedSet("Bun", [
			aQuestionInput("A1", "Alpha"),
			aQuestionInput("A2", "Alpha"),
		]);
		await play(quizSetId, [false, false]);

		await expect(
			session.execute({
				telegramUserId: USER,
				mode: QuizAttemptMode.WeakTopics,
			}),
		).rejects.toThrow(NothingToReviewError);
	});

	test("ignores questions with no topic", async () => {
		const quizSetId = await seedSet("Bun", [
			aQuestionInput("A1", "Alpha"),
			aQuestionInput("A2", "Alpha"),
			aQuestionInput("A3", "Alpha"),
			aQuestionInput("N1"),
			aQuestionInput("N2"),
			aQuestionInput("N3"),
		]);
		await play(quizSetId, [false, false, false, false, false, false]);

		expect(
			(
				await session.execute({
					telegramUserId: USER,
					mode: QuizAttemptMode.WeakTopics,
				})
			).topic,
		).toBe("Alpha");
	});
});

describe("rating a review (§5.3)", () => {
	const queuedQuestion = async (): Promise<{
		quizSetId: QuizSetId;
		questionId: never;
	}> => {
		const quizSetId = await seedSet("Bun", [aQuestionInput("One")]);
		await play(quizSetId, [false]);

		return { quizSetId, questionId: questionsOf(quizSetId)[0]?.id as never };
	};

	test("hard brings the question back soonest", async () => {
		const { questionId } = await queuedQuestion();

		const hard = await rate.execute({
			telegramUserId: USER,
			questionId,
			rating: ReviewRating.Hard,
		});
		const easy = await rate.execute({
			telegramUserId: USER,
			questionId,
			rating: ReviewRating.Easy,
		});

		expect(hard.dueAt.getTime()).toBeLessThan(easy.dueAt.getTime());
	});

	test("rating moves the due date without changing the streak", async () => {
		const { questionId } = await queuedQuestion();
		const before = context.reviews.findByQuestion(USER, questionId);

		await rate.execute({
			telegramUserId: USER,
			questionId,
			rating: ReviewRating.Easy,
		});

		const after = context.reviews.findByQuestion(USER, questionId);

		expect(after?.streak).toBe(before?.streak as number);
		expect(after?.state).toBe(before?.state as never);
		expect(after?.dueAt.getTime()).toBeGreaterThan(
			before?.dueAt.getTime() as number,
		);
	});

	test("refuses a question that is not queued", async () => {
		const quizSetId = await seedSet("Bun", [aQuestionInput("One")]);

		await expect(
			rate.execute({
				telegramUserId: USER,
				questionId: questionsOf(quizSetId)[0]?.id as never,
				rating: ReviewRating.Good,
			}),
		).rejects.toThrow(NoReviewItemError);
	});
});
