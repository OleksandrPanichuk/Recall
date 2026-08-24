import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	attemptCount,
	type MemoryContext,
} from "@tests/fixtures/memory.fixture";
import { QuizAttemptStatus } from "@/domain/quiz-attempt/quiz-attempt";
import { type QuizSetId, toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { defaultQuizSettings } from "@/domain/settings/quiz-settings";
import type { AddQuestionsUseCase } from "../quiz-sets/add-questions";
import type { ArchiveQuizSetUseCase } from "../quiz-sets/archive-quiz-set";
import type { CreateQuizSetUseCase } from "../quiz-sets/create-quiz-set";
import { QuizSetNotFoundError } from "../quiz-sets/update-quiz-set";
import { ownerScope, quizScope } from "../settings/resolve-quiz-settings";
import {
	type AttemptsHarness,
	aQuestionInput,
	createAttemptsHarness,
	USER,
} from "./attempts.fixture";
import type { FinishQuizAttemptUseCase } from "./finish-quiz-attempt";
import type { PauseQuizAttemptUseCase } from "./resume-quiz-attempt";
import {
	AttemptAlreadyInProgressError,
	QuizSetNotPublishedError,
	type StartQuizAttemptUseCase,
} from "./start-quiz-attempt";

let context: MemoryContext;
let add: AddQuestionsUseCase;
let create: CreateQuizSetUseCase;
let archive: ArchiveQuizSetUseCase;
let start: StartQuizAttemptUseCase;
let pause: PauseQuizAttemptUseCase;
let finish: FinishQuizAttemptUseCase;
let seedPublishedSet: AttemptsHarness["seedPublishedSet"];
let questionIdOf: AttemptsHarness["questionIdOf"];

beforeEach(() => {
	({
		context,
		add,
		create,
		archive,
		start,
		pause,
		finish,
		seedPublishedSet,
		questionIdOf,
	} = createAttemptsHarness());
});

afterEach(() => {
	context.close();
});

describe("StartQuizAttemptUseCase", () => {
	test("starts an attempt on a published set", async () => {
		const quizSetId = await seedPublishedSet();

		const result = await start.execute({ quizSetId, telegramUserId: USER });

		expect(result.resumed).toBe(false);
		expect(String(result.currentQuestionId)).toBe(
			String(await questionIdOf(quizSetId, 0)),
		);
		expect(
			(await context.scope.attempts.findById(result.attemptId))?.status,
		).toBe(QuizAttemptStatus.Active);
	});

	test("starting the same set again resumes instead of duplicating", async () => {
		const quizSetId = await seedPublishedSet();
		const first = await start.execute({ quizSetId, telegramUserId: USER });

		const second = await start.execute({ quizSetId, telegramUserId: USER });

		expect(second.resumed).toBe(true);
		expect(String(second.attemptId)).toBe(String(first.attemptId));
		expect(attemptCount(context.store)).toBe(1);
	});

	test("starting the same set resumes a paused attempt", async () => {
		const quizSetId = await seedPublishedSet();
		await start.execute({ quizSetId, telegramUserId: USER });
		context.clock.advance(60_000);
		await pause.execute({ telegramUserId: USER });
		context.clock.advance(60_000);

		const result = await start.execute({ quizSetId, telegramUserId: USER });

		expect(result.resumed).toBe(true);
		expect(
			(await context.scope.attempts.findById(result.attemptId))?.status,
		).toBe(QuizAttemptStatus.Active);
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

		expect(attemptCount(context.store)).toBe(2);
	});
});

describe("shuffled question order", () => {
	const PROMPTS = ["One", "Two", "Three", "Four", "Five", "Six", "Seven"];

	const enableShuffle = (quizSetId: QuizSetId): Promise<void> =>
		context.unitOfWork.run(({ reviews }) =>
			reviews.saveSettings(quizScope(quizSetId), {
				...defaultQuizSettings(),
				shuffleQuestions: true,
			}),
		);

	const plannedPrompts = async (
		quizSetId: QuizSetId,
	): Promise<readonly string[]> => {
		const questions =
			(await context.scope.quizzes.findById(quizSetId))?.questions ?? [];
		const attempt = await context.scope.attempts.findActiveFor(USER);

		return (attempt?.questionIds ?? []).map(
			(questionId) =>
				questions.find((candidate) => candidate.id === questionId)?.prompt ??
				"",
		);
	};

	test("keeps the authored order while the toggle is off", async () => {
		const quizSetId = await seedPublishedSet(PROMPTS);

		await start.execute({ quizSetId, telegramUserId: USER });

		expect(await plannedPrompts(quizSetId)).toEqual(PROMPTS);
	});

	test("plans a different order once the toggle is on", async () => {
		const quizSetId = await seedPublishedSet(PROMPTS);
		await enableShuffle(quizSetId);

		await start.execute({ quizSetId, telegramUserId: USER });

		expect(await plannedPrompts(quizSetId)).not.toEqual(PROMPTS);
		expect([...(await plannedPrompts(quizSetId))].toSorted()).toEqual(
			[...PROMPTS].toSorted(),
		);
	});

	test("asks the shuffled question first, not the authored one", async () => {
		const quizSetId = await seedPublishedSet(PROMPTS);
		await enableShuffle(quizSetId);

		const result = await start.execute({ quizSetId, telegramUserId: USER });
		const attempt = await context.scope.attempts.findActiveFor(USER);

		expect(String(result.currentQuestionId)).toBe(
			String(attempt?.questionIds[0]),
		);
	});

	test("keeps the planned order when the attempt is resumed", async () => {
		const quizSetId = await seedPublishedSet(PROMPTS);
		await enableShuffle(quizSetId);
		await start.execute({ quizSetId, telegramUserId: USER });

		const planned = await plannedPrompts(quizSetId);
		await pause.execute({ telegramUserId: USER });
		await start.execute({ quizSetId, telegramUserId: USER });

		expect(await plannedPrompts(quizSetId)).toEqual(planned);
	});

	test("follows the global toggle when the set has no settings of its own", async () => {
		const quizSetId = await seedPublishedSet(PROMPTS);
		await context.unitOfWork.run(({ reviews }) =>
			reviews.saveSettings(ownerScope, {
				...defaultQuizSettings(),
				shuffleQuestions: true,
			}),
		);

		await start.execute({ quizSetId, telegramUserId: USER });

		expect(await plannedPrompts(quizSetId)).not.toEqual(PROMPTS);
	});

	test("shuffles a repetition run too, without letting undue questions in", async () => {
		const quizSetId = await seedPublishedSet(PROMPTS);
		await enableShuffle(quizSetId);

		const due = await Promise.all(
			PROMPTS.slice(0, 6).map((_, index) => questionIdOf(quizSetId, index)),
		);

		await context.unitOfWork.run(({ reviews }) =>
			reviews.saveSchedules(
				due.map((questionId) => ({
					questionId,
					telegramUserId: USER,
					repetitionCount: 1,
					lapses: 0,
					lastCompletedAt: new Date("2026-07-01T09:00:00.000Z"),
					dueAt: new Date("2026-07-02T09:00:00.000Z"),
				})),
			),
		);

		await start.execute({ quizSetId, telegramUserId: USER, onlyDue: true });

		expect(await plannedPrompts(quizSetId)).not.toEqual(PROMPTS.slice(0, 6));
		expect([...(await plannedPrompts(quizSetId))].toSorted()).toEqual(
			[...PROMPTS.slice(0, 6)].toSorted(),
		);
	});
});
