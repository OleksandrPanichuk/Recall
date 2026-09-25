import { beforeEach, describe, expect, test } from "bun:test";
import type { RepositoryScope } from "@tests/fixtures/repository-scope";
import type { UnitOfWork } from "@tests/fixtures/unit-of-work";
import {
	AttemptEntity,
	QuizAttemptMode,
	QuizAttemptStatus,
	toQuizAttemptId,
} from "@/modules/attempts";
import {
	createQuestion,
	Difficulty,
	type QuestionId,
	QuestionType,
	QuizSetEntity,
	toQuestionId,
	toQuestionOptionId,
	toQuizSetId,
} from "@/modules/quizzes";
import { RecallGrade } from "@/modules/scheduling";

export interface AttemptRepositoryHarness {
	readonly unitOfWork: UnitOfWork<RepositoryScope>;
	readonly scope: RepositoryScope;
	reset(): Promise<void>;
}

export const USER = 797736131;

const at = new Date("2026-08-01T10:00:00.000Z");
const later = (minutes: number): Date =>
	new Date(at.getTime() + minutes * 60_000);
const uuid = (): string => crypto.randomUUID();

const question = (
	id: string,
	prompt: string,
	position: number,
	topic: string,
) =>
	createQuestion({
		id: toQuestionId(id),
		type: QuestionType.SingleChoice,
		prompt,
		difficulty: Difficulty.Medium,
		position,
		topic,
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

export function describeAttemptRepository(
	implementation: string,
	open: () => AttemptRepositoryHarness,
	options: { readonly skip?: boolean } = {},
): void {
	describe.skipIf(options.skip === true)(
		`the ${implementation} attempt repository`,
		() => {
			let harness: AttemptRepositoryHarness;
			let quizId: string;
			let firstQuestion: string;
			let secondQuestion: string;
			let quiz: QuizSetEntity;

			beforeEach(async () => {
				harness = open();
				await harness.reset();

				quizId = uuid();
				firstQuestion = uuid();
				secondQuestion = uuid();

				quiz = QuizSetEntity.addQuestions(
					QuizSetEntity.create({
						id: toQuizSetId(quizId),
						title: "Replication",
						language: "en",
						createdAt: at,
					}),
					[
						question(firstQuestion, "Why replicate?", 0, "replication"),
						question(secondQuestion, "What is an LSM tree?", 1, "storage"),
					],
					at,
				);

				await harness.unitOfWork.run(async ({ quizzes }) => {
					await quizzes.save(quiz);
				});
			});

			const started = () =>
				AttemptEntity.start({
					id: toQuizAttemptId(uuid()),
					quizSetId: toQuizSetId(quizId),
					telegramUserId: USER,
					mode: QuizAttemptMode.Full,
					questionIds: [
						toQuestionId(firstQuestion),
						toQuestionId(secondQuestion),
					],
					startedAt: at,
				});

			const answered = (correctly: boolean, answeredAt = later(1)) => {
				const attempt = started();
				const target = quiz.questions[0];

				if (target === undefined) {
					throw new Error("the fixture has no question");
				}

				const option = target.options.find(
					(candidate) => candidate.isCorrect === correctly,
				);

				return AttemptEntity.recordResponse(attempt, {
					questionId: target.id,
					selectedOptionIds: option === undefined ? [] : [option.id],
					isCorrect: correctly,
					answeredAt,
				});
			};

			test("round-trips an attempt with its planned questions", async () => {
				const attempt = started();

				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(attempt);
				});

				const stored = await harness.scope.attempts.findById(attempt.id);

				expect(stored?.questionIds.map(String)).toEqual([
					firstQuestion,
					secondQuestion,
				]);
				expect(stored?.telegramUserId).toBe(USER);
				expect(stored?.responses).toEqual([]);
			});

			test("treats an id that is not a uuid as missing, not as an error", async () => {
				expect(
					await harness.scope.attempts.findById(
						toQuizAttemptId("does-not-exist"),
					),
				).toBeUndefined();
				expect(
					await harness.scope.attempts.answerCount(toQuestionId("nonsense")),
				).toBe(0);
			});

			test("keeps a recorded answer", async () => {
				const attempt = answered(true);

				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(attempt);
				});

				const stored = await harness.scope.attempts.findById(attempt.id);

				expect(stored?.responses).toHaveLength(1);
				expect(stored?.responses[0]?.isCorrect).toBe(true);
				expect(stored?.responses[0]?.selectedOptionIds).toHaveLength(1);
			});

			test("keeps how a recalled answer felt", async () => {
				const attempt = answered(true);

				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(attempt);
				});

				expect(
					(await harness.scope.attempts.findById(attempt.id))?.responses[0]
						?.recall,
				).toBeUndefined();

				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(
						AttemptEntity.rateResponse(
							attempt,
							attempt.responses[0]?.questionId as QuestionId,
							RecallGrade.Hard,
							later(2),
						),
					);
				});

				expect(
					(await harness.scope.attempts.findById(attempt.id))?.responses[0]
						?.recall,
				).toBe(RecallGrade.Hard);
			});

			test("and a later rating replaces the earlier one", async () => {
				const attempt = answered(true);
				const questionId = attempt.responses[0]?.questionId as QuestionId;

				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(attempt);
					await attempts.save(
						AttemptEntity.rateResponse(
							attempt,
							questionId,
							RecallGrade.Hard,
							later(2),
						),
					);
					await attempts.save(
						AttemptEntity.rateResponse(
							attempt,
							questionId,
							RecallGrade.Easy,
							later(3),
						),
					);
				});

				expect(
					(await harness.scope.attempts.findById(attempt.id))?.responses[0]
						?.recall,
				).toBe(RecallGrade.Easy);
			});

			test("a wrong answer is never rated, because Again is not a feeling", async () => {
				const attempt = answered(false);
				const questionId = attempt.responses[0]?.questionId as QuestionId;

				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(attempt);
					await attempts.save(
						AttemptEntity.rateResponse(
							attempt,
							questionId,
							RecallGrade.Easy,
							later(2),
						),
					);
				});

				expect(
					(await harness.scope.attempts.findById(attempt.id))?.responses[0]
						?.recall,
				).toBeUndefined();
			});

			test("finds the attempt still in progress", async () => {
				const attempt = started();

				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(attempt);
				});

				const active = await harness.scope.attempts.findActive();

				expect(String(active?.id)).toBe(String(attempt.id));
			});

			test("ignores a stale copy rather than rewinding an answer", async () => {
				const attempt = answered(true);

				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(attempt);
					await attempts.save(started());
				});

				const stored = await harness.scope.attempts.findById(attempt.id);

				expect(stored?.responses).toHaveLength(1);
			});

			test("summarises completed attempts", async () => {
				const finished = AttemptEntity.complete(answered(true), later(2));

				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(finished);
				});

				const summaries = await harness.scope.attempts.listCompletedForQuiz(
					toQuizSetId(quizId),
				);

				expect(summaries).toHaveLength(1);
				expect(summaries[0]?.correct).toBe(1);
				expect(summaries[0]?.total).toBe(1);
				expect(summaries[0]?.completedAt).toBeDefined();
			});

			test("reports accuracy per topic", async () => {
				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(
						AttemptEntity.complete(answered(false), later(2)),
					);
				});

				const topics = await harness.scope.attempts.topicAccuracy(
					toQuizSetId(quizId),
				);

				expect(topics).toHaveLength(1);
				expect(topics[0]?.topic).toBe("replication");
				expect(topics[0]?.answered).toBe(1);
				expect(topics[0]?.correct).toBe(0);
			});

			test("names the questions answered wrongly, once each", async () => {
				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(
						AttemptEntity.complete(answered(false), later(2)),
					);
					await attempts.save(
						AttemptEntity.complete(answered(false), later(3)),
					);
				});

				const wrong = await harness.scope.attempts.incorrectQuestionIds(
					toQuizSetId(quizId),
				);

				expect(wrong.map(String)).toEqual([firstQuestion]);
			});

			test("forgets a mistake once a later attempt got it right", async () => {
				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(
						AttemptEntity.complete(answered(false, later(1)), later(2)),
					);
					await attempts.save(
						AttemptEntity.complete(answered(true, later(3)), later(4)),
					);
				});

				expect(
					await harness.scope.attempts.incorrectQuestionIds(
						toQuizSetId(quizId),
					),
				).toEqual([]);
			});

			test("names it again when a later attempt got it wrong once more", async () => {
				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(
						AttemptEntity.complete(answered(false, later(1)), later(2)),
					);
					await attempts.save(
						AttemptEntity.complete(answered(true, later(3)), later(4)),
					);
					await attempts.save(
						AttemptEntity.complete(answered(false, later(5)), later(6)),
					);
				});

				expect(
					(
						await harness.scope.attempts.incorrectQuestionIds(
							toQuizSetId(quizId),
						)
					).map(String),
				).toEqual([firstQuestion]);
			});

			test("counts the answers a question has collected", async () => {
				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(answered(true));
				});

				expect(
					await harness.scope.attempts.answerCount(toQuestionId(firstQuestion)),
				).toBe(1);
				expect(
					await harness.scope.attempts.answerCount(
						toQuestionId(secondQuestion),
					),
				).toBe(0);
			});

			const racedWhileFound = async (
				find: (
					attempts: RepositoryScope["attempts"],
				) => Promise<AttemptEntity | undefined>,
			): Promise<readonly boolean[]> => {
				let found: () => void = () => {};
				const firstFound = new Promise<void>((resolve) => {
					found = resolve;
				});
				const finishWith = async (
					attempts: RepositoryScope["attempts"],
					minutes: number,
					pause: () => Promise<void>,
				): Promise<boolean> => {
					const attempt = await find(attempts);

					await pause();

					if (attempt?.status !== QuizAttemptStatus.Active) {
						return false;
					}

					await attempts.save(AttemptEntity.complete(attempt, later(minutes)));

					return true;
				};

				return Promise.all([
					harness.unitOfWork.run(({ attempts }) =>
						finishWith(attempts, 5, async () => {
							found();
							await Bun.sleep(50);
						}),
					),
					harness.unitOfWork.run(async ({ attempts }) => {
						await firstFound;

						return finishWith(attempts, 6, async () => {});
					}),
				]);
			};

			test("holds the active attempt it found until the unit of work ends", async () => {
				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(answered(true));
				});

				expect(
					await racedWhileFound((attempts) => attempts.findActive()),
				).toEqual([true, false]);
			});

			test("holds an attempt found by id until the unit of work ends", async () => {
				const attempt = answered(true);

				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(attempt);
				});

				expect(
					await racedWhileFound((attempts) => attempts.findById(attempt.id)),
				).toEqual([true, false]);
			});

			test("keeps every answer and rating across a run of saves", async () => {
				const [first, second] = quiz.questions;

				if (first === undefined || second === undefined) {
					throw new Error("the fixture has two questions");
				}

				const once = AttemptEntity.recordResponse(started(), {
					questionId: first.id,
					selectedOptionIds: first.options.slice(0, 1).map(({ id }) => id),
					isCorrect: true,
					answeredAt: later(1),
					skipped: false,
					creditEarned: 1,
					creditPossible: 1,
				});
				const twice = AttemptEntity.recordResponse(once, {
					questionId: second.id,
					selectedOptionIds: second.options.slice(1, 2).map(({ id }) => id),
					isCorrect: false,
					answeredAt: later(2),
					typedAnswer: "a guess",
					skipped: true,
					creditEarned: 0,
					creditPossible: 1,
				});
				const rated = AttemptEntity.rateResponse(
					twice,
					first.id,
					RecallGrade.Easy,
					later(3),
				);
				const finished = AttemptEntity.complete(rated, later(4));

				for (const version of [once, twice, twice, rated, finished]) {
					await harness.unitOfWork.run(async ({ attempts }) => {
						await attempts.save(version);
					});
				}

				const stored = await harness.scope.attempts.findById(once.id);
				const plain = (attempt: AttemptEntity | undefined) =>
					attempt?.responses.map((response) => ({
						...response,
						questionId: String(response.questionId),
						selectedOptionIds: response.selectedOptionIds.map(String),
					}));

				expect(stored?.status).toBe(QuizAttemptStatus.Completed);
				expect(stored?.completedAt?.toISOString()).toBe(later(4).toISOString());
				expect(stored?.questionIds.map(String)).toEqual([
					firstQuestion,
					secondQuestion,
				]);
				expect(plain(stored)).toEqual(plain(finished));
				expect(stored?.responses[0]?.recall).toBe(RecallGrade.Easy);
			});

			test("a new attempt saved with several answers keeps each one as it was", async () => {
				const [first, second] = quiz.questions;

				if (first === undefined || second === undefined) {
					throw new Error("the fixture has two questions");
				}

				const attempt = AttemptEntity.recordResponse(
					AttemptEntity.recordResponse(started(), {
						questionId: first.id,
						selectedOptionIds: first.options.slice(0, 1).map(({ id }) => id),
						isCorrect: true,
						answeredAt: later(1),
						skipped: false,
					}),
					{
						questionId: second.id,
						selectedOptionIds: [],
						isCorrect: false,
						answeredAt: later(2),
						typedAnswer: "a guess",
						skipped: true,
						creditEarned: 0,
						creditPossible: 1,
					},
				);

				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(attempt);
				});

				const stored = await harness.scope.attempts.findById(attempt.id);

				expect(
					stored?.responses.map((response) => ({
						...response,
						questionId: String(response.questionId),
						selectedOptionIds: response.selectedOptionIds.map(String),
					})),
				).toEqual(
					attempt.responses.map((response) => ({
						...response,
						questionId: String(response.questionId),
						selectedOptionIds: response.selectedOptionIds.map(String),
					})),
				);
			});

			test("rolls a failed save back completely", async () => {
				const attempt = started();

				try {
					await harness.unitOfWork.run(async ({ attempts }) => {
						await attempts.save(attempt);

						throw new Error("give it back");
					});
				} catch {}

				expect(
					await harness.scope.attempts.findById(attempt.id),
				).toBeUndefined();
			});
		},
	);
}
