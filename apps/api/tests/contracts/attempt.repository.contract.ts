import { beforeEach, describe, expect, test } from "bun:test";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import {
	completeQuizAttempt,
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
	type QuizSet,
	toQuizSetId,
} from "@/domain/quiz-set/quiz-set";

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
			let quiz: QuizSet;

			beforeEach(async () => {
				harness = open();
				await harness.reset();

				quizId = uuid();
				firstQuestion = uuid();
				secondQuestion = uuid();

				quiz = addQuestions(
					createQuizSet({
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
				startQuizAttempt({
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

				return recordResponse(attempt, {
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
				const finished = completeQuizAttempt(answered(true), later(2));

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
					await attempts.save(completeQuizAttempt(answered(false), later(2)));
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
					await attempts.save(completeQuizAttempt(answered(false), later(2)));
					await attempts.save(completeQuizAttempt(answered(false), later(3)));
				});

				const wrong = await harness.scope.attempts.incorrectQuestionIds(
					toQuizSetId(quizId),
				);

				expect(wrong.map(String)).toEqual([firstQuestion]);
			});

			test("forgets a mistake once a later attempt got it right", async () => {
				await harness.unitOfWork.run(async ({ attempts }) => {
					await attempts.save(
						completeQuizAttempt(answered(false, later(1)), later(2)),
					);
					await attempts.save(
						completeQuizAttempt(answered(true, later(3)), later(4)),
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
						completeQuizAttempt(answered(false, later(1)), later(2)),
					);
					await attempts.save(
						completeQuizAttempt(answered(true, later(3)), later(4)),
					);
					await attempts.save(
						completeQuizAttempt(answered(false, later(5)), later(6)),
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
