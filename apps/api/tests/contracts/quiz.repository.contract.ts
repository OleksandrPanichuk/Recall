import { beforeEach, describe, expect, test } from "bun:test";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import { toFolderId } from "@/domain/folder/folder";
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
	type QuizSet,
	toQuizSetId,
} from "@/domain/quiz-set/quiz-set";

export interface QuizRepositoryHarness {
	readonly unitOfWork: UnitOfWork<RepositoryScope>;
	readonly scope: RepositoryScope;
	reset(): Promise<void>;
	markAnswered(questionId: string): Promise<void>;
}

const at = new Date("2026-08-01T10:00:00.000Z");
const uuid = (): string => crypto.randomUUID();

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
				text: `Right for ${prompt}`,
				isCorrect: true,
				position: 0,
			},
			{
				id: toQuestionOptionId(uuid()),
				text: `Wrong for ${prompt}`,
				isCorrect: false,
				position: 1,
			},
		],
	});

const quizWith = (
	id: string,
	prompts: readonly [string, string][],
): QuizSet => {
	const empty = createQuizSet({
		id: toQuizSetId(id),
		title: "Designing Data-Intensive Applications",
		language: "en",
		tags: ["systems"],
		createdAt: at,
	});

	return addQuestions(
		empty,
		prompts.map(([questionId, prompt], index) =>
			question(questionId, prompt, index),
		),
		at,
	);
};

export function describeQuizRepository(
	implementation: string,
	open: () => QuizRepositoryHarness,
	options: { readonly skip?: boolean } = {},
): void {
	describe.skipIf(options.skip === true)(
		`the ${implementation} quiz repository`,
		() => {
			let harness: QuizRepositoryHarness;

			beforeEach(async () => {
				harness = open();
				await harness.reset();
			});

			test("round-trips a quiz with its questions and options", async () => {
				const id = uuid();
				const first = uuid();

				await harness.unitOfWork.run(async ({ quizzes }) => {
					await quizzes.save(quizWith(id, [[first, "Why replicate?"]]));
				});

				const stored = await harness.scope.quizzes.findById(toQuizSetId(id));

				expect(stored?.title).toBe("Designing Data-Intensive Applications");
				expect(stored?.tags).toEqual(["systems"]);
				expect(stored?.questions).toHaveLength(1);
				expect(stored?.questions[0]?.prompt).toBe("Why replicate?");
				expect(stored?.questions[0]?.options).toHaveLength(2);
			});

			test("keeps the vocabulary item a question was generated from", async () => {
				const quizId = uuid();
				const itemId = uuid();
				const generated = createQuestion({
					...question(uuid(), "der Zug", 0),
					vocabularyItemId: itemId,
				});

				await harness.unitOfWork.run(async ({ quizzes }) => {
					await quizzes.save(
						addQuestions(
							createQuizSet({
								id: toQuizSetId(quizId),
								title: "German",
								language: "de",
								createdAt: at,
							}),
							[generated],
							at,
						),
					);
				});

				const stored = await harness.scope.quizzes.findById(
					toQuizSetId(quizId),
				);

				expect(stored?.questions[0]?.vocabularyItemId).toBe(itemId);
			});

			test("a question with no vocabulary item reads back without one", async () => {
				const quizId = uuid();

				await harness.unitOfWork.run(async ({ quizzes }) => {
					await quizzes.save(
						addQuestions(
							createQuizSet({
								id: toQuizSetId(quizId),
								title: "German",
								language: "de",
								createdAt: at,
							}),
							[question(uuid(), "plain", 0)],
							at,
						),
					);
				});

				const stored = await harness.scope.quizzes.findById(
					toQuizSetId(quizId),
				);

				expect(stored?.questions[0]?.vocabularyItemId).toBeUndefined();
			});

			test("treats an id that is not a uuid as missing, not as an error", async () => {
				const missing = toQuizSetId("does-not-exist");

				expect(await harness.scope.quizzes.findById(missing)).toBeUndefined();
				expect(await harness.scope.quizzes.versionOf(missing)).toBeUndefined();
				expect(
					await harness.scope.quizzes.list({ pageId: toFolderId("nonsense") }),
				).toEqual([]);
			});

			test("starts at version 0 and advances on every save", async () => {
				const id = uuid();
				const quiz = quizWith(id, [[uuid(), "First"]]);

				const created = await harness.unitOfWork.run(({ quizzes }) =>
					quizzes.save(quiz),
				);
				const updated = await harness.unitOfWork.run(({ quizzes }) =>
					quizzes.save(quiz),
				);

				expect(created).toBe(0);
				expect(updated).toBe(1);
				expect(await harness.scope.quizzes.versionOf(toQuizSetId(id))).toBe(1);
			});

			test("refuses a save against a stale version", async () => {
				const id = uuid();
				const quiz = quizWith(id, [[uuid(), "First"]]);

				await harness.unitOfWork.run(({ quizzes }) => quizzes.save(quiz));
				await harness.unitOfWork.run(({ quizzes }) => quizzes.save(quiz));

				let name = "";

				try {
					await harness.unitOfWork.run(({ quizzes }) => quizzes.save(quiz, 0));
				} catch (error) {
					name = (error as Error).name;
				}

				expect(name).toBe("QuizVersionConflictError");
			});

			test("keeps surviving question ids when one is added and one removed", async () => {
				const id = uuid();
				const kept = uuid();
				const dropped = uuid();
				const added = uuid();

				await harness.unitOfWork.run(async ({ quizzes }) => {
					await quizzes.save(
						quizWith(id, [
							[kept, "Kept"],
							[dropped, "Dropped"],
						]),
					);
				});

				await harness.unitOfWork.run(async ({ quizzes }) => {
					await quizzes.save(
						quizWith(id, [
							[kept, "Kept"],
							[added, "Added"],
						]),
					);
				});

				const stored = await harness.scope.quizzes.findById(toQuizSetId(id));
				const ids = (stored?.questions ?? []).map((entry) => String(entry.id));

				expect(ids).toContain(kept);
				expect(ids).toContain(added);
				expect(ids).not.toContain(dropped);
			});

			test("refuses to drop a question that has answers", async () => {
				const id = uuid();
				const kept = uuid();
				const answered = uuid();

				await harness.unitOfWork.run(async ({ quizzes }) => {
					await quizzes.save(
						quizWith(id, [
							[kept, "Kept"],
							[answered, "Answered"],
						]),
					);
				});

				await harness.markAnswered(answered);

				let failed = false;

				try {
					await harness.unitOfWork.run(async ({ quizzes }) => {
						await quizzes.save(quizWith(id, [[kept, "Kept"]]));
					});
				} catch {
					failed = true;
				}

				expect(failed).toBe(true);

				const stored = await harness.scope.quizzes.findById(toQuizSetId(id));

				expect(stored?.questions).toHaveLength(2);
			});

			test("lists by status", async () => {
				const first = uuid();

				await harness.unitOfWork.run(async ({ quizzes }) => {
					await quizzes.save(quizWith(first, [[uuid(), "Draft one"]]));
				});

				const drafts = await harness.scope.quizzes.list({
					statuses: ["draft"],
				});
				const published = await harness.scope.quizzes.list({
					statuses: ["published"],
				});

				expect(drafts).toHaveLength(1);
				expect(drafts[0]?.questionCount).toBe(1);
				expect(published).toHaveLength(0);
			});

			test("rolls a failed save back completely", async () => {
				const id = uuid();

				try {
					await harness.unitOfWork.run(async ({ quizzes }) => {
						await quizzes.save(quizWith(id, [[uuid(), "Doomed"]]));

						throw new Error("give it back");
					});
				} catch {}

				expect(
					await harness.scope.quizzes.findById(toQuizSetId(id)),
				).toBeUndefined();
			});
		},
	);
}
