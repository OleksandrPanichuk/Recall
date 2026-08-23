import { beforeEach, describe, expect, test } from "bun:test";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
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
import {
	defaultQuizSettings,
	withExamMode,
} from "@/domain/settings/quiz-settings";
import {
	createVocabularyItem,
	toVocabularyItemId,
} from "@/domain/vocabulary/vocabulary-item";

export interface ReviewRepositoryHarness {
	readonly unitOfWork: UnitOfWork<RepositoryScope>;
	readonly scope: RepositoryScope;
	reset(): Promise<void>;
}

const USER = 797736131;
const at = new Date("2026-08-01T10:00:00.000Z");
const day = (offset: number): Date =>
	new Date(at.getTime() + offset * 24 * 60 * 60 * 1000);
const uuid = (): string => crypto.randomUUID();

export function describeReviewRepository(
	implementation: string,
	open: () => ReviewRepositoryHarness,
	options: { readonly skip?: boolean } = {},
): void {
	describe.skipIf(options.skip === true)(
		`the ${implementation} review and term-pair repositories`,
		() => {
			let harness: ReviewRepositoryHarness;
			let quizId: string;
			let firstQuestion: string;
			let secondQuestion: string;

			beforeEach(async () => {
				harness = open();
				await harness.reset();

				quizId = uuid();
				firstQuestion = uuid();
				secondQuestion = uuid();

				const question = (id: string, position: number) =>
					createQuestion({
						id: toQuestionId(id),
						type: QuestionType.SingleChoice,
						prompt: `Question ${position}`,
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

				await harness.unitOfWork.run(async ({ quizzes }) => {
					await quizzes.save(
						addQuestions(
							createQuizSet({
								id: toQuizSetId(quizId),
								title: "Replication",
								language: "en",
								createdAt: at,
							}),
							[question(firstQuestion, 0), question(secondQuestion, 1)],
							at,
						),
					);
				});
			});

			const schedule = (
				questionId: string,
				lapses: number,
				dueOffset: number,
			) => ({
				questionId: toQuestionId(questionId),
				telegramUserId: USER,
				repetitionCount: 2,
				lapses,
				lastCompletedAt: at,
				dueAt: day(dueOffset),
			});

			test("saves and reads schedules for the questions asked for", async () => {
				await harness.unitOfWork.run(async ({ reviews }) => {
					await reviews.saveSchedules([
						schedule(firstQuestion, 0, 1),
						schedule(secondQuestion, 0, 2),
					]);
				});

				const found = await harness.scope.reviews.findSchedules(
					[toQuestionId(firstQuestion)],
					USER,
				);

				expect(found).toHaveLength(1);
				expect(String(found[0]?.questionId)).toBe(firstQuestion);
				expect(found[0]?.repetitionCount).toBe(2);
			});

			test("upserts a schedule rather than duplicating it", async () => {
				await harness.unitOfWork.run(async ({ reviews }) => {
					await reviews.saveSchedules([schedule(firstQuestion, 0, 1)]);
					await reviews.saveSchedules([schedule(firstQuestion, 3, 5)]);
				});

				const found = await harness.scope.reviews.findSchedules(
					[toQuestionId(firstQuestion)],
					USER,
				);

				expect(found).toHaveLength(1);
				expect(found[0]?.lapses).toBe(3);
			});

			test("lists what is due, oldest first, and nothing later", async () => {
				await harness.unitOfWork.run(async ({ reviews }) => {
					await reviews.saveSchedules([
						schedule(secondQuestion, 0, 2),
						schedule(firstQuestion, 0, 1),
					]);
				});

				const due = await harness.scope.reviews.listDue(USER, day(1));

				expect(due.map((entry) => String(entry.questionId))).toEqual([
					firstQuestion,
				]);
			});

			test("lists leeches above the threshold, worst first", async () => {
				await harness.unitOfWork.run(async ({ reviews }) => {
					await reviews.saveSchedules([
						schedule(firstQuestion, 2, 1),
						schedule(secondQuestion, 5, 1),
					]);
				});

				const leeches = await harness.scope.reviews.listLeeches(USER, 3);

				expect(leeches.map((entry) => String(entry.questionId))).toEqual([
					secondQuestion,
				]);
			});

			test("keeps owner settings and quiz settings apart", async () => {
				const owner = defaultQuizSettings();
				const perQuiz = withExamMode(defaultQuizSettings(), true);

				await harness.unitOfWork.run(async ({ reviews }) => {
					await reviews.saveSettings({ kind: "owner" }, owner);
					await reviews.saveSettings(
						{ kind: "quiz", quizId: toQuizSetId(quizId) },
						perQuiz,
					);
				});

				const storedOwner = await harness.scope.reviews.findSettings({
					kind: "owner",
				});
				const storedQuiz = await harness.scope.reviews.findSettings({
					kind: "quiz",
					quizId: toQuizSetId(quizId),
				});

				expect(storedOwner?.examMode).toBe(false);
				expect(storedQuiz?.examMode).toBe(true);
			});

			test("overwrites settings for the same scope", async () => {
				await harness.unitOfWork.run(async ({ reviews }) => {
					await reviews.saveSettings({ kind: "owner" }, defaultQuizSettings());
					await reviews.saveSettings(
						{ kind: "owner" },
						withExamMode(defaultQuizSettings(), true),
					);
				});

				const stored = await harness.scope.reviews.findSettings({
					kind: "owner",
				});

				expect(stored?.examMode).toBe(true);
			});

			test("clears settings for one scope only", async () => {
				await harness.unitOfWork.run(async ({ reviews }) => {
					await reviews.saveSettings({ kind: "owner" }, defaultQuizSettings());
					await reviews.saveSettings(
						{ kind: "quiz", quizId: toQuizSetId(quizId) },
						defaultQuizSettings(),
					);
					await reviews.clearSettings({
						kind: "quiz",
						quizId: toQuizSetId(quizId),
					});
				});

				expect(
					await harness.scope.reviews.findSettings({ kind: "owner" }),
				).toBeDefined();
				expect(
					await harness.scope.reviews.findSettings({
						kind: "quiz",
						quizId: toQuizSetId(quizId),
					}),
				).toBeUndefined();
			});

			test("round-trips a term pair and lists it for its quiz", async () => {
				const pairId = uuid();

				await harness.unitOfWork.run(async ({ termPairs }) => {
					await termPairs.save(
						createVocabularyItem({
							id: toVocabularyItemId(pairId),
							quizSetId: toQuizSetId(quizId),
							terms: ["shard"],
							translations: ["шард", "шарда"],
							topic: "partitioning",
							createdAt: at,
						}),
					);
				});

				const stored = await harness.scope.termPairs.findById(
					toVocabularyItemId(pairId),
				);
				const listed = await harness.scope.termPairs.listForQuiz(
					toQuizSetId(quizId),
				);

				expect(stored?.terms).toEqual(["shard"]);
				expect(stored?.translations).toEqual(["шард", "шарда"]);
				expect(stored?.topic).toBe("partitioning");
				expect(listed).toHaveLength(1);
			});

			test("rolls a failed schedule write back", async () => {
				try {
					await harness.unitOfWork.run(async ({ reviews }) => {
						await reviews.saveSchedules([schedule(firstQuestion, 0, 1)]);

						throw new Error("give it back");
					});
				} catch {}

				expect(
					await harness.scope.reviews.findSchedules(
						[toQuestionId(firstQuestion)],
						USER,
					),
				).toEqual([]);
			});
		},
	);
}
