import { beforeEach, describe, expect, test } from "bun:test";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import {
	QuizAttemptMode,
	recordResponse,
	startQuizAttempt,
	toQuizAttemptId,
} from "@/domain/quiz-attempt/quiz-attempt";
import { createQuestion } from "@/domain/quiz-set/create-question";
import {
	Difficulty,
	QuestionType,
	toQuestionId,
	toQuestionOptionId,
} from "@/domain/quiz-set/question";
import {
	addQuestions,
	createQuizSet,
	toQuizSetId,
} from "@/domain/quiz-set/quiz-set";
import { scheduleAfter } from "@/domain/repetition/repetition";

export interface AnalyticsRepositoryHarness {
	readonly unitOfWork: UnitOfWork<RepositoryScope>;
	readonly scope: RepositoryScope;
	reset(): Promise<void>;
}

const uuid = (): string => crypto.randomUUID();
const day = (iso: string): Date => new Date(`${iso}T12:00:00.000Z`);

const question = (id: string, prompt: string, position: number) =>
	createQuestion({
		id: toQuestionId(id),
		type: QuestionType.SingleChoice,
		prompt,
		difficulty: Difficulty.Medium,
		position,
		options: [
			{
				id: toQuestionOptionId(uuid()),
				text: "Right",
				isCorrect: true,
				position: 0,
			},
			{
				id: toQuestionOptionId(uuid()),
				text: "Wrong",
				isCorrect: false,
				position: 1,
			},
		],
	});

export function describeAnalyticsRepository(
	implementation: string,
	open: () => AnalyticsRepositoryHarness,
	options: { readonly skip?: boolean } = {},
): void {
	describe.skipIf(options.skip === true)(
		`the ${implementation} analytics repository`,
		() => {
			let harness: AnalyticsRepositoryHarness;
			let quizId: string;
			let easy: string;
			let hard: string;

			const window = {
				from: day("2026-07-01"),
				to: day("2026-09-01"),
				timezone: "UTC",
			};

			const optionOf = async (questionId: string, correct: boolean) => {
				const quiz = await harness.scope.quizzes.findById(toQuizSetId(quizId));
				const option = quiz?.questions
					.find((candidate) => String(candidate.id) === questionId)
					?.options.find((candidate) => candidate.isCorrect === correct);

				if (option === undefined) {
					throw new Error("the fixture has no such option");
				}

				return option.id;
			};

			const answer = async (questionId: string, correct: boolean, at: Date) => {
				const selected = await optionOf(questionId, correct);
				const attempt = startQuizAttempt({
					id: toQuizAttemptId(uuid()),
					quizSetId: toQuizSetId(quizId),
					mode: QuizAttemptMode.Full,
					questionIds: [toQuestionId(questionId)],
					startedAt: at,
				});

				await harness.unitOfWork.run(({ attempts }) =>
					attempts.save(
						recordResponse(attempt, {
							questionId: toQuestionId(questionId),
							selectedOptionIds: [selected],
							isCorrect: correct,
							answeredAt: at,
						}),
					),
				);
			};

			beforeEach(async () => {
				harness = open();
				await harness.reset();

				quizId = uuid();
				easy = uuid();
				hard = uuid();

				await harness.unitOfWork.run(({ quizzes }) =>
					quizzes.save(
						addQuestions(
							createQuizSet({
								id: toQuizSetId(quizId),
								title: "Replication",
								language: "en",
								createdAt: day("2026-08-01"),
							}),
							[question(easy, "Easy one", 0), question(hard, "Hard one", 1)],
							day("2026-08-01"),
						),
					),
				);
			});

			test("buckets answers by the day they were given", async () => {
				await answer(easy, true, day("2026-08-10"));
				await answer(hard, false, day("2026-08-10"));
				await answer(easy, true, day("2026-08-12"));

				expect(await harness.scope.analytics.dailyActivity(window)).toEqual([
					{ day: "2026-08-10", attempts: 2, answered: 2, correct: 1 },
					{ day: "2026-08-12", attempts: 1, answered: 1, correct: 1 },
				]);
			});

			test("leaves out answers from outside the window", async () => {
				await answer(easy, true, day("2026-06-01"));

				expect(await harness.scope.analytics.dailyActivity(window)).toEqual([]);
			});

			test("ranks the least-answered-correctly question first", async () => {
				await answer(easy, true, day("2026-08-10"));
				await answer(easy, true, day("2026-08-11"));
				await answer(hard, false, day("2026-08-10"));
				await answer(hard, false, day("2026-08-11"));

				const hardest = await harness.scope.analytics.hardestQuestions(10, 2);

				expect(hardest.map((stat) => stat.prompt)).toEqual([
					"Hard one",
					"Easy one",
				]);
				expect(hardest[0]).toMatchObject({
					quizSetTitle: "Replication",
					answered: 2,
					correct: 0,
				});
			});

			test("ignores a question answered fewer times than asked for", async () => {
				await answer(hard, false, day("2026-08-10"));

				expect(await harness.scope.analytics.hardestQuestions(10, 2)).toEqual(
					[],
				);
			});

			test("counts what falls due on each day ahead", async () => {
				await answer(easy, true, day("2026-08-10"));
				await harness.unitOfWork.run(({ reviews }) =>
					reviews.saveSchedules([
						scheduleAfter(
							undefined,
							toQuestionId(easy),
							undefined,
							{ intervalsDays: [3], maxIntervalDays: 30, maxRepetitions: 5 },
							day("2026-08-10"),
							new Date("2026-08-10T00:00:00.000Z"),
						),
					]),
				);

				expect(await harness.scope.analytics.dueForecast(window)).toEqual([
					{ day: "2026-08-13", due: 1 },
				]);
			});
		},
	);
}
