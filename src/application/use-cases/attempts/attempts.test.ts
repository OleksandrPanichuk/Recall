import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	createTestContext,
	type TestContext,
} from "@tests/fixtures/application.fixture";
import { countRows } from "@tests/integration/sqlite/migrated-database";
import { createSqliteQuizAttemptRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-attempt.repository";
import { QuizAttemptStatus } from "@/domain/quiz-attempt/quiz-attempt";
import {
	QuestionNotInAttemptError,
	QuizAttemptValidationError,
} from "@/domain/quiz-attempt/quiz-attempt.errors";
import type { QuestionId } from "@/domain/quiz-set/question";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import { type QuizSetId, toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { AddQuestions, type QuestionInput } from "../quiz-sets/add-questions";
import { ArchiveQuizSet } from "../quiz-sets/archive-quiz-set";
import { CreateQuizSet } from "../quiz-sets/create-quiz-set";
import { PublishQuizSet } from "../quiz-sets/publish-quiz-set";
import { QuizSetNotFoundError } from "../quiz-sets/update-quiz-set";
import { AnswerQuestion, AttemptNotActiveError } from "./answer-question";
import { FinishQuizAttempt } from "./finish-quiz-attempt";
import {
	NoActiveAttemptError,
	PauseQuizAttempt,
	ResumeQuizAttempt,
} from "./resume-quiz-attempt";
import {
	AttemptAlreadyInProgressError,
	QuizSetNotPublishedError,
	StartQuizAttempt,
} from "./start-quiz-attempt";

const USER = 42;

let context: TestContext;
let add: AddQuestions;
let create: CreateQuizSet;
let publish: PublishQuizSet;
let archive: ArchiveQuizSet;
let start: StartQuizAttempt;
let pause: PauseQuizAttempt;
let resume: ResumeQuizAttempt;
let answer: AnswerQuestion;
let finish: FinishQuizAttempt;

beforeEach(() => {
	context = createTestContext();
	create = new CreateQuizSet(context);
	add = new AddQuestions(context);
	publish = new PublishQuizSet(context);
	archive = new ArchiveQuizSet(context);
	start = new StartQuizAttempt(context);
	pause = new PauseQuizAttempt(context);
	resume = new ResumeQuizAttempt(context);
	answer = new AnswerQuestion(context);
	finish = new FinishQuizAttempt(context);
});

afterEach(() => {
	context.close();
});

const aQuestionInput = (prompt: string): QuestionInput => ({
	type: QuestionType.SingleChoice,
	prompt,
	difficulty: Difficulty.Medium,
	explanation: `Because of ${prompt}`,
	options: [
		{ text: `Right for ${prompt}`, isCorrect: true },
		{ text: `Wrong for ${prompt}`, isCorrect: false },
	],
});

async function seedPublishedSet(prompts = ["One", "Two"]): Promise<QuizSetId> {
	const { quizSetId } = await create.execute({
		title: "Bun persistence",
		language: "uk",
	});

	await add.execute({ quizSetId, questions: prompts.map(aQuestionInput) });
	await publish.execute({ quizSetId });

	return quizSetId;
}

const questionsOf = (quizSetId: QuizSetId) =>
	context.quizSets.findById(quizSetId)?.questions ?? [];

const positionOf = (
	quizSetId: QuizSetId,
	index: number,
	correct: boolean,
): number => {
	const question = questionsOf(quizSetId)[index];
	const option = question?.options.find(
		(candidate) => candidate.isCorrect === correct,
	);

	if (option === undefined) {
		throw new Error("fixture is missing an option");
	}

	return option.position;
};

const questionIdOf = (quizSetId: QuizSetId, index: number): QuestionId => {
	const question = questionsOf(quizSetId)[index];

	if (question === undefined) {
		throw new Error("fixture is missing a question");
	}

	return question.id;
};

describe("StartQuizAttempt", () => {
	test("starts an attempt on a published set", async () => {
		const quizSetId = await seedPublishedSet();

		const result = await start.execute({ quizSetId, telegramUserId: USER });

		expect(result.resumed).toBe(false);
		expect(String(result.currentQuestionId)).toBe(
			String(questionIdOf(quizSetId, 0)),
		);
		expect(context.attempts.findById(result.attemptId)?.status).toBe(
			QuizAttemptStatus.Active,
		);
	});

	test("starting the same set again resumes instead of duplicating", async () => {
		const quizSetId = await seedPublishedSet();
		const first = await start.execute({ quizSetId, telegramUserId: USER });

		const second = await start.execute({ quizSetId, telegramUserId: USER });

		expect(second.resumed).toBe(true);
		expect(String(second.attemptId)).toBe(String(first.attemptId));
		expect(countRows(context.database, "quiz_attempts")).toBe(1);
	});

	test("starting the same set resumes a paused attempt", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);
		await pause.execute({ telegramUserId: USER });
		context.clock.advance(60_000);

		const result = await start.execute({ quizSetId, telegramUserId: USER });

		expect(result.resumed).toBe(true);
		expect(context.attempts.findById(result.attemptId)?.status).toBe(
			QuizAttemptStatus.Active,
		);
	});

	test("refuses to start a different set while one is unfinished", async () => {
		const first = await seedPublishedSet();
		const second = await seedPublishedSet(["Three"]);
		await start.execute({ quizSetId: first, telegramUserId: USER });

		await expect(
			start.execute({ quizSetId: second, telegramUserId: USER }),
		).rejects.toThrow(AttemptAlreadyInProgressError);
	});

	test("refuses a draft set", async () => {
		const { quizSetId } = await create.execute({
			title: "Draft",
			language: "uk",
		});
		await add.execute({ quizSetId, questions: [aQuestionInput("One")] });

		await expect(
			start.execute({ quizSetId, telegramUserId: USER }),
		).rejects.toThrow(QuizSetNotPublishedError);
	});

	test("refuses an archived set", async () => {
		const quizSetId = await seedPublishedSet();
		await archive.execute({ quizSetId });

		await expect(
			start.execute({ quizSetId, telegramUserId: USER }),
		).rejects.toThrow(QuizSetNotPublishedError);
	});

	test("rejects an unknown set", async () => {
		await expect(
			start.execute({
				quizSetId: toQuizSetId("missing"),
				telegramUserId: USER,
			}),
		).rejects.toThrow(QuizSetNotFoundError);
	});

	// Being blocked must never be a dead end: an attempt on a set that was
	// archived mid-session can still be finished, which frees the user up.
	test("finishing releases the block, even when its set was archived", async () => {
		const first = await seedPublishedSet();
		const second = await seedPublishedSet(["Three"]);
		await start.execute({ quizSetId: first, telegramUserId: USER });
		await archive.execute({ quizSetId: first });
		context.clock.advance(60_000);

		await finish.execute({ telegramUserId: USER });

		await expect(
			start.execute({ quizSetId: second, telegramUserId: USER }),
		).resolves.toMatchObject({ resumed: false });
	});

	test("keeps attempts separate per user", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });

		await start.execute({ quizSetId, telegramUserId: 7 });

		expect(countRows(context.database, "quiz_attempts")).toBe(2);
	});
});

describe("PauseQuizAttempt and ResumeQuizAttempt", () => {
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

describe("AnswerQuestion", () => {
	test("records a correct answer and advances", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);

		const result = await answer.execute({
			telegramUserId: USER,
			questionId: questionIdOf(quizSetId, 0),
			selectedOptionPositions: [positionOf(quizSetId, 0, true)],
		});

		expect(result.isCorrect).toBe(true);
		expect(result.alreadyAnswered).toBe(false);
		expect(result.explanation).toBe("Because of One");
		expect(result.correctOptionIds).toHaveLength(1);
		expect(String(result.nextQuestionId)).toBe(
			String(questionIdOf(quizSetId, 1)),
		);
		expect(result.score).toEqual({ correct: 1, total: 2, percentage: 50 });
	});

	test("records a wrong answer and still returns the correct options", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);

		const result = await answer.execute({
			telegramUserId: USER,
			questionId: questionIdOf(quizSetId, 0),
			selectedOptionPositions: [positionOf(quizSetId, 0, false)],
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
			questionId: questionIdOf(quizSetId, 0),
			selectedOptionPositions: [positionOf(quizSetId, 0, true)],
		};
		await answer.execute(command);

		const replay = await answer.execute(command);

		expect(replay.alreadyAnswered).toBe(true);
		expect(replay.score).toEqual({ correct: 1, total: 2, percentage: 50 });
		expect(String(replay.nextQuestionId)).toBe(
			String(questionIdOf(quizSetId, 1)),
		);
		expect(countRows(context.database, "question_responses")).toBe(1);
	});

	test("a replay cannot turn a wrong answer into a right one", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);
		await answer.execute({
			telegramUserId: USER,
			questionId: questionIdOf(quizSetId, 0),
			selectedOptionPositions: [positionOf(quizSetId, 0, false)],
		});

		const replay = await answer.execute({
			telegramUserId: USER,
			questionId: questionIdOf(quizSetId, 0),
			selectedOptionPositions: [positionOf(quizSetId, 0, true)],
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
				questionId: questionIdOf(quizSetId, 1),
				selectedOptionPositions: [positionOf(quizSetId, 1, true)],
			}),
		).rejects.toThrow(QuestionNotInAttemptError);
		expect(countRows(context.database, "question_responses")).toBe(0);
	});

	test("refuses an option position the question does not have", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);

		await expect(
			answer.execute({
				telegramUserId: USER,
				questionId: questionIdOf(quizSetId, 0),
				selectedOptionPositions: [99],
			}),
		).rejects.toThrow(QuizAttemptValidationError);
		expect(countRows(context.database, "question_responses")).toBe(0);
	});

	test("refuses an empty selection", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);

		await expect(
			answer.execute({
				telegramUserId: USER,
				questionId: questionIdOf(quizSetId, 0),
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
				questionId: questionIdOf(quizSetId, 0),
				selectedOptionPositions: [positionOf(quizSetId, 0, true)],
			}),
		).rejects.toThrow(AttemptNotActiveError);
	});

	test("refuses with no attempt at all", async () => {
		const quizSetId = await seedPublishedSet();

		await expect(
			answer.execute({
				telegramUserId: USER,
				questionId: questionIdOf(quizSetId, 0),
				selectedOptionPositions: [positionOf(quizSetId, 0, true)],
			}),
		).rejects.toThrow(NoActiveAttemptError);
	});

	test("the last answer leaves no next question", async () => {
		const quizSetId = await seedPublishedSet(["One"]);
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);

		const result = await answer.execute({
			telegramUserId: USER,
			questionId: questionIdOf(quizSetId, 0),
			selectedOptionPositions: [positionOf(quizSetId, 0, true)],
		});

		expect(result.nextQuestionId).toBeUndefined();
	});
});

describe("FinishQuizAttempt", () => {
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
