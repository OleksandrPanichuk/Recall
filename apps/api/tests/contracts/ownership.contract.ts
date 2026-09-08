import { beforeEach, describe, expect, test } from "bun:test";
import type { RepositoryScope } from "@tests/fixtures/repository-scope";
import type { UnitOfWork } from "@tests/fixtures/unit-of-work";
import {
	AttemptEntity,
	QuizAttemptMode,
	toQuizAttemptId,
} from "@/modules/attempts";
import { PageEntity, toPageId } from "@/modules/pages";
import {
	createQuestion,
	Difficulty,
	QuestionType,
	QuizSetEntity,
	toQuestionId,
	toQuestionOptionId,
	toQuizSetId,
} from "@/modules/quizzes";
import { StudySettingsEntity } from "@/modules/study-settings";

export interface OwnedSide {
	readonly unitOfWork: UnitOfWork<RepositoryScope>;
	readonly scope: RepositoryScope;
}

export interface OwnershipHarness {
	readonly mine: OwnedSide;
	readonly theirs: OwnedSide;
	reset(): Promise<void>;
}

const at = new Date("2026-08-01T10:00:00.000Z");
const uuid = (): string => crypto.randomUUID();

const aQuestion = (id: string) =>
	createQuestion({
		id: toQuestionId(id),
		type: QuestionType.SingleChoice,
		prompt: "Why replicate?",
		difficulty: Difficulty.Medium,
		position: 0,
		options: [
			{
				id: toQuestionOptionId(uuid()),
				text: "Availability",
				isCorrect: true,
				position: 0,
			},
			{
				id: toQuestionOptionId(uuid()),
				text: "Smaller disks",
				isCorrect: false,
				position: 1,
			},
		],
	});

export function describeOwnership(
	implementation: string,
	open: () => OwnershipHarness,
	options: { readonly skip?: boolean } = {},
): void {
	describe.skipIf(options.skip === true)(
		`ownership in the ${implementation} repositories`,
		() => {
			let harness: OwnershipHarness;

			beforeEach(async () => {
				harness = open();
				await harness.reset();
			});

			test("a page one owner writes is invisible to the other", async () => {
				const id = uuid();

				await harness.mine.unitOfWork.run(({ pages }) =>
					pages.save(
						PageEntity.create({
							id: toPageId(id),
							name: "Books",
							createdAt: at,
						}),
					),
				);

				expect(
					await harness.mine.scope.pages.findById(toPageId(id)),
				).toBeDefined();
				expect(
					await harness.theirs.scope.pages.findById(toPageId(id)),
				).toBeUndefined();
				expect(await harness.theirs.scope.pages.listAll()).toEqual([]);
			});

			test("both owners can name a page the same thing", async () => {
				const mine = uuid();
				const theirs = uuid();
				const page = (id: string) =>
					PageEntity.create({ id: toPageId(id), name: "Books", createdAt: at });

				await harness.mine.unitOfWork.run(({ pages }) =>
					pages.save(page(mine)),
				);
				await harness.theirs.unitOfWork.run(({ pages }) =>
					pages.save(page(theirs)),
				);

				expect(await harness.mine.scope.pages.listAll()).toHaveLength(1);
				expect(await harness.theirs.scope.pages.listAll()).toHaveLength(1);
			});

			test("a quiz one owner writes is invisible to the other", async () => {
				const id = uuid();
				const quiz = QuizSetEntity.create({
					id: toQuizSetId(id),
					title: "Designing Data-Intensive Applications",
					language: "en",
					createdAt: at,
				});

				await harness.mine.unitOfWork.run(({ quizzes }) => quizzes.save(quiz));

				expect(
					await harness.mine.scope.quizzes.findById(toQuizSetId(id)),
				).toBeDefined();
				expect(
					await harness.theirs.scope.quizzes.findById(toQuizSetId(id)),
				).toBeUndefined();
				expect(await harness.theirs.scope.quizzes.list()).toEqual([]);
				expect(
					await harness.theirs.scope.quizzes.versionOf(toQuizSetId(id)),
				).toBeUndefined();
			});

			test("one owner cannot delete another's page", async () => {
				const id = uuid();

				await harness.mine.unitOfWork.run(({ pages }) =>
					pages.save(
						PageEntity.create({
							id: toPageId(id),
							name: "Books",
							createdAt: at,
						}),
					),
				);
				await harness.theirs.unitOfWork.run(({ pages }) =>
					pages.delete(toPageId(id)),
				);

				expect(
					await harness.mine.scope.pages.findById(toPageId(id)),
				).toBeDefined();
			});

			test("a share one owner mints is invisible to the other", async () => {
				const id = uuid();

				await harness.mine.unitOfWork.run(async ({ pages }) => {
					await pages.save(
						PageEntity.create({
							id: toPageId(id),
							name: "Books",
							createdAt: at,
						}),
					);
					await pages.saveShare({
						pageId: toPageId(id),
						token: "mine-alone",
						createdAt: at,
					});
				});

				expect(
					await harness.theirs.scope.pages.shareOf(toPageId(id)),
				).toBeUndefined();
				expect(
					(await harness.mine.scope.pages.shareOf(toPageId(id)))?.token,
				).toBe("mine-alone");
			});

			test("one owner cannot share another's page", async () => {
				const id = uuid();

				await harness.mine.unitOfWork.run(({ pages }) =>
					pages.save(
						PageEntity.create({
							id: toPageId(id),
							name: "Books",
							createdAt: at,
						}),
					),
				);
				await harness.theirs.unitOfWork.run(({ pages }) =>
					pages.saveShare({
						pageId: toPageId(id),
						token: "not-theirs-to-give",
						createdAt: at,
					}),
				);

				expect(
					await harness.mine.scope.pages.shareOf(toPageId(id)),
				).toBeUndefined();
				expect(
					await harness.theirs.scope.pages.shareOf(toPageId(id)),
				).toBeUndefined();
			});

			test("one owner cannot close another's link", async () => {
				const id = uuid();

				await harness.mine.unitOfWork.run(async ({ pages }) => {
					await pages.save(
						PageEntity.create({
							id: toPageId(id),
							name: "Books",
							createdAt: at,
						}),
					);
					await pages.saveShare({
						pageId: toPageId(id),
						token: "still-open",
						createdAt: at,
					});
				});
				await harness.theirs.unitOfWork.run(({ pages }) =>
					pages.deleteShare(toPageId(id)),
				);

				expect(
					(await harness.mine.scope.pages.shareOf(toPageId(id)))?.token,
				).toBe("still-open");
			});

			test("an attempt one owner starts is invisible to the other", async () => {
				const quizId = uuid();
				const questionId = uuid();
				const attemptId = uuid();
				const telegramUserId = 42;

				const question = aQuestion(questionId);
				const quiz = QuizSetEntity.addQuestions(
					QuizSetEntity.create({
						id: toQuizSetId(quizId),
						title: "Replication",
						language: "en",
						createdAt: at,
					}),
					[question],
					at,
				);

				await harness.mine.unitOfWork.run(async ({ quizzes, attempts }) => {
					await quizzes.save(quiz);
					await attempts.save(
						AttemptEntity.start({
							id: toQuizAttemptId(attemptId),
							quizSetId: toQuizSetId(quizId),
							telegramUserId,
							mode: QuizAttemptMode.Full,
							questionIds: [question.id],
							startedAt: at,
						}),
					);
				});

				expect(await harness.mine.scope.attempts.findActive()).toBeDefined();
				expect(
					await harness.theirs.scope.attempts.findActive(),
				).toBeUndefined();
				expect(
					await harness.theirs.scope.attempts.findById(
						toQuizAttemptId(attemptId),
					),
				).toBeUndefined();
			});

			test("settings are per owner, not per instance", async () => {
				await harness.mine.unitOfWork.run(({ reviews }) =>
					reviews.saveSettings(
						{ kind: "owner" },
						{ ...StudySettingsEntity.defaults(), examMode: true },
					),
				);

				const mine = await harness.mine.scope.reviews.findSettings({
					kind: "owner",
				});
				const theirs = await harness.theirs.scope.reviews.findSettings({
					kind: "owner",
				});

				expect(mine?.examMode).toBe(true);
				expect(theirs).toBeUndefined();
			});
		},
	);
}
