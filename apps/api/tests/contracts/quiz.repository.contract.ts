import { beforeEach, describe, expect, test } from "bun:test";
import type { RepositoryScope } from "@tests/fixtures/repository-scope";
import type { UnitOfWork } from "@tests/fixtures/unit-of-work";
import { toPageId } from "@/modules/pages";
import {
	createQuestion,
	Difficulty,
	QuestionType,
	QuizSetEntity,
	toQuestionId,
	toQuestionOptionId,
	toQuizSetId,
} from "@/modules/quizzes";

export interface QuizRepositoryHarness {
	readonly unitOfWork: UnitOfWork<RepositoryScope>;
	readonly scope: RepositoryScope;
	reset(): Promise<void>;
	markAnswered(questionId: string): Promise<void>;
}

const at = new Date("2026-08-01T10:00:00.000Z");
const later = new Date("2026-08-02T10:00:00.000Z");
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
): QuizSetEntity => {
	const empty = QuizSetEntity.create({
		id: toQuizSetId(id),
		title: "Designing Data-Intensive Applications",
		language: "en",
		tags: ["systems"],
		createdAt: at,
	});

	return QuizSetEntity.addQuestions(
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
						QuizSetEntity.addQuestions(
							QuizSetEntity.create({
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
						QuizSetEntity.addQuestions(
							QuizSetEntity.create({
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
					await harness.scope.quizzes.list({ pageId: toPageId("nonsense") }),
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

			test("adding one question to a large set leaves the others as they were", async () => {
				const id = uuid();
				const prompts = Array.from(
					{ length: 200 },
					(_, index): [string, string] => [uuid(), `Question ${index}`],
				);

				await harness.unitOfWork.run(({ quizzes }) =>
					quizzes.save(quizWith(id, prompts)),
				);

				const before = await harness.scope.quizzes.findById(toQuizSetId(id));

				if (before === undefined) {
					throw new Error("the quiz was not saved");
				}

				const added = uuid();

				await harness.unitOfWork.run(({ quizzes }) =>
					quizzes.save(
						QuizSetEntity.addQuestions(
							before,
							[question(added, "One more", 200)],
							later,
						),
						0,
					),
				);

				const after = await harness.scope.quizzes.findById(toQuizSetId(id));

				expect(after?.questions).toHaveLength(201);
				expect(after?.questions.slice(0, 200)).toEqual([...before.questions]);
				expect(after?.questions[200]?.prompt).toBe("One more");
				expect(after?.questions[200]?.options).toHaveLength(2);
				expect(await harness.scope.quizzes.versionOf(toQuizSetId(id))).toBe(1);
			});

			test("swapping two questions' places and prompts rewrites them in place", async () => {
				const id = uuid();
				const first = uuid();
				const second = uuid();
				const third = uuid();

				await harness.unitOfWork.run(({ quizzes }) =>
					quizzes.save(
						quizWith(id, [
							[first, "First"],
							[second, "Second"],
							[third, "Third"],
						]),
					),
				);

				const stored = await harness.scope.quizzes.findById(toQuizSetId(id));
				const [one, two, three] = stored?.questions ?? [];

				if (stored === undefined || !one || !two || !three) {
					throw new Error("the quiz was not saved");
				}

				await harness.unitOfWork.run(({ quizzes }) =>
					quizzes.save({
						...stored,
						questions: [
							createQuestion({ ...two, position: 0 }),
							createQuestion({ ...one, position: 1 }),
							three,
						],
					}),
				);

				const swapped = await harness.scope.quizzes.findById(toQuizSetId(id));

				expect(swapped?.questions.map((entry) => String(entry.id))).toEqual([
					second,
					first,
					third,
				]);

				await harness.unitOfWork.run(({ quizzes }) =>
					quizzes.save({
						...stored,
						questions: [
							createQuestion({
								...one,
								prompt: "Second",
								options: two.options,
							}),
							createQuestion({ ...two, prompt: "First", options: one.options }),
							three,
						],
					}),
				);

				const renamed = await harness.scope.quizzes.findById(toQuizSetId(id));

				expect(renamed?.questions.map((entry) => entry.prompt)).toEqual([
					"Second",
					"First",
					"Third",
				]);
				expect(renamed?.questions[0]?.options).toEqual(two.options);
				expect(renamed?.questions[1]?.options).toEqual(one.options);
				expect(renamed?.questions[2]).toEqual(three);
			});

			test("rewrites the options of the one question that changed", async () => {
				const id = uuid();
				const changed = uuid();
				const untouched = uuid();

				await harness.unitOfWork.run(({ quizzes }) =>
					quizzes.save(
						quizWith(id, [
							[changed, "Changed"],
							[untouched, "Untouched"],
						]),
					),
				);

				const stored = await harness.scope.quizzes.findById(toQuizSetId(id));
				const [target, other] = stored?.questions ?? [];

				if (stored === undefined || !target || !other) {
					throw new Error("the quiz was not saved");
				}

				const options = [
					{
						id: toQuestionOptionId(uuid()),
						text: "A new right answer",
						isCorrect: true,
						position: 0,
					},
					{
						id: toQuestionOptionId(uuid()),
						text: "A new wrong answer",
						isCorrect: false,
						position: 1,
					},
					{
						id: toQuestionOptionId(uuid()),
						text: "Another wrong answer",
						isCorrect: false,
						position: 2,
					},
				];

				await harness.unitOfWork.run(({ quizzes }) =>
					quizzes.save({
						...stored,
						questions: [createQuestion({ ...target, options }), other],
					}),
				);

				const after = await harness.scope.quizzes.findById(toQuizSetId(id));

				expect(after?.questions[0]?.options).toEqual(options);
				expect(after?.questions[1]).toEqual(other);
			});

			test("locates questions across sets without loading the sets", async () => {
				const draftId = uuid();
				const publishedId = uuid();
				const inDraft = uuid();
				const inPublished = uuid();

				await harness.unitOfWork.run(async ({ quizzes }) => {
					await quizzes.save(quizWith(draftId, [[inDraft, "Draft question"]]));
					await quizzes.save(
						QuizSetEntity.publish(
							quizWith(publishedId, [[inPublished, "Live question"]]),
							later,
						),
					);
				});

				const located = await harness.scope.quizzes.locateQuestions([
					toQuestionId(inDraft),
					toQuestionId(inPublished),
					toQuestionId(uuid()),
					toQuestionId("not-a-uuid"),
				]);

				expect(
					[...located].sort((one, other) =>
						one.prompt.localeCompare(other.prompt),
					),
				).toEqual([
					{
						questionId: toQuestionId(inDraft),
						quizSetId: toQuizSetId(draftId),
						quizSetTitle: "Designing Data-Intensive Applications",
						quizSetStatus: "draft",
						prompt: "Draft question",
					},
					{
						questionId: toQuestionId(inPublished),
						quizSetId: toQuizSetId(publishedId),
						quizSetTitle: "Designing Data-Intensive Applications",
						quizSetStatus: "published",
						prompt: "Live question",
					},
				]);
				expect(await harness.scope.quizzes.locateQuestions([])).toEqual([]);
			});

			test("lists every question with its set, set by set in title order", async () => {
				const zoology = uuid();
				const algebra = uuid();
				const q = Array.from({ length: 4 }, () => uuid());

				await harness.unitOfWork.run(async ({ quizzes }) => {
					await quizzes.save({
						...quizWith(zoology, [
							[q[0] as string, "Z first"],
							[q[1] as string, "Z second"],
						]),
						title: "Zoology",
					});
					await quizzes.save({
						...QuizSetEntity.publish(
							quizWith(algebra, [
								[q[2] as string, "A first"],
								[q[3] as string, "A second"],
							]),
							later,
						),
						title: "Algebra",
					});
				});

				const all = await harness.scope.quizzes.listQuestions();

				expect(
					all.map((row) => [row.setTitle, row.setStatus, row.question.prompt]),
				).toEqual([
					["Algebra", "published", "A first"],
					["Algebra", "published", "A second"],
					["Zoology", "draft", "Z first"],
					["Zoology", "draft", "Z second"],
				]);
				expect(all[0]?.question.options).toHaveLength(2);
				expect(all[0]?.quizSetId).toBe(toQuizSetId(algebra));

				const one = await harness.scope.quizzes.listQuestions({
					quizSetId: toQuizSetId(zoology),
				});

				expect(one.map((row) => String(row.question.id))).toEqual([
					q[0] as string,
					q[1] as string,
				]);
				expect(
					await harness.scope.quizzes.listQuestions({
						quizSetId: toQuizSetId(uuid()),
					}),
				).toEqual([]);
				expect(
					await harness.scope.quizzes.listQuestions({
						quizSetId: toQuizSetId("not-a-uuid"),
					}),
				).toEqual([]);
			});

			test("counts the answers of many questions at once", async () => {
				const id = uuid();
				const twice = uuid();
				const once = uuid();
				const never = uuid();

				await harness.unitOfWork.run(({ quizzes }) =>
					quizzes.save(
						quizWith(id, [
							[twice, "Twice"],
							[once, "Once"],
							[never, "Never"],
						]),
					),
				);

				await harness.markAnswered(twice);
				await harness.markAnswered(twice);
				await harness.markAnswered(once);

				const counts = await harness.scope.quizzes.answerCounts([
					toQuestionId(twice),
					toQuestionId(once),
					toQuestionId(never),
					toQuestionId("not-a-uuid"),
				]);

				expect(counts.get(toQuestionId(twice))).toBe(2);
				expect(counts.get(toQuestionId(once))).toBe(1);
				expect(counts.get(toQuestionId(never)) ?? 0).toBe(0);
				expect(
					await harness.scope.quizzes.answerCount(toQuestionId(twice)),
				).toBe(2);
				expect((await harness.scope.quizzes.answerCounts([])).size).toBe(0);
			});

			test("answers for more ids than one statement can bind", async () => {
				const id = uuid();
				const answered = uuid();

				await harness.unitOfWork.run(({ quizzes }) =>
					quizzes.save(quizWith(id, [[answered, "Answered"]])),
				);
				await harness.markAnswered(answered);

				const ids = [
					...Array.from({ length: 70_000 }, () => toQuestionId(uuid())),
					toQuestionId(answered),
				];

				expect(
					(await harness.scope.quizzes.answerCounts(ids)).get(
						toQuestionId(answered),
					),
				).toBe(1);
				expect(
					(await harness.scope.quizzes.locateQuestions(ids)).map((found) =>
						String(found.questionId),
					),
				).toEqual([answered]);
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
