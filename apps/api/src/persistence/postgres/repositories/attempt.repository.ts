import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	inArray,
	notExists,
	sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
	AttemptRepository,
	AttemptStatistics,
	TopicAccuracy,
} from "@/application/ports/repositories/attempt.repository";
import {
	type QuizAttempt,
	type QuizAttemptId,
	QuizAttemptStatus,
	restoreQuizAttempt,
	toQuizAttemptId,
} from "@/domain/quiz-attempt/quiz-attempt";
import {
	isQuizAttemptMode,
	isQuizAttemptStatus,
} from "@/domain/quiz-attempt/quiz-attempt.constants";
import {
	type QuestionId,
	toQuestionId,
	toQuestionOptionId,
} from "@/domain/quiz-set/question";
import { type QuizSetId, toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { attemptQuestions, attempts, questions, responses } from "../schema";
import type { Executor } from "../unit-of-work";
import { isUuid } from "../uuid";

type AttemptRow = typeof attempts.$inferSelect;

export class CorruptedAttemptRowError extends Error {
	constructor(id: string, issue: string) {
		super(`Attempt ${id} cannot be read: ${issue}`);
		this.name = "CorruptedAttemptRowError";
	}
}

export function createAttemptPostgresRepository(
	executor: Executor,
): AttemptRepository {
	const hydrate = async (row: AttemptRow): Promise<QuizAttempt> => {
		if (!isQuizAttemptMode(row.mode)) {
			throw new CorruptedAttemptRowError(row.id, `mode "${row.mode}"`);
		}

		if (!isQuizAttemptStatus(row.status)) {
			throw new CorruptedAttemptRowError(row.id, `status "${row.status}"`);
		}

		const planned = await executor
			.select({ questionId: attemptQuestions.questionId })
			.from(attemptQuestions)
			.where(eq(attemptQuestions.attemptId, row.id))
			.orderBy(asc(attemptQuestions.position));

		const answers = await executor
			.select()
			.from(responses)
			.where(eq(responses.attemptId, row.id))
			.orderBy(asc(responses.answeredAt));

		return restoreQuizAttempt({
			id: toQuizAttemptId(row.id),
			quizSetId: toQuizSetId(row.quizId),
			telegramUserId: row.telegramUserId ?? 0,
			mode: row.mode,
			status: row.status,
			questionIds: planned.map((entry) => toQuestionId(entry.questionId)),
			responses: answers.map((answer) => ({
				questionId: toQuestionId(answer.questionId),
				selectedOptionIds: answer.selectedOptionIds.map(toQuestionOptionId),
				isCorrect: answer.isCorrect,
				answeredAt: answer.answeredAt,
				typedAnswer: answer.typedAnswer ?? undefined,
				skipped: answer.skipped,
				creditEarned: answer.creditEarned ?? undefined,
				creditPossible: answer.creditPossible ?? undefined,
			})),
			startedAt: row.startedAt,
			updatedAt: row.updatedAt,
			completedAt: row.completedAt ?? undefined,
		});
	};

	const first = async (
		rows: readonly AttemptRow[],
	): Promise<QuizAttempt | undefined> => {
		const [row] = rows;

		return row === undefined ? undefined : hydrate(row);
	};

	return {
		async save(attempt: QuizAttempt): Promise<void> {
			const id = String(attempt.id);
			const row = {
				id,
				quizId: String(attempt.quizSetId),
				telegramUserId: attempt.telegramUserId,
				mode: attempt.mode,
				status: attempt.status,
				startedAt: attempt.startedAt,
				updatedAt: attempt.updatedAt,
				completedAt: attempt.completedAt ?? null,
			};

			const [stored] = await executor
				.select({ updatedAt: attempts.updatedAt })
				.from(attempts)
				.where(eq(attempts.id, id))
				.limit(1);

			// Applying a stale copy would rewind updated_at past answers already
			// stored, leaving a row the restore factory rejects.
			if (stored !== undefined && stored.updatedAt > row.updatedAt) {
				return;
			}

			await executor
				.insert(attempts)
				.values(row)
				.onConflictDoUpdate({ target: attempts.id, set: row });

			await executor
				.delete(attemptQuestions)
				.where(eq(attemptQuestions.attemptId, id));

			await executor.insert(attemptQuestions).values(
				attempt.questionIds.map((questionId, position) => ({
					attemptId: id,
					position,
					questionId: String(questionId),
				})),
			);

			for (const answer of attempt.responses) {
				const answerRow = {
					attemptId: id,
					questionId: String(answer.questionId),
					selectedOptionIds: answer.selectedOptionIds.map(String),
					isCorrect: answer.isCorrect,
					typedAnswer: answer.typedAnswer ?? null,
					skipped: answer.skipped ?? false,
					creditEarned: answer.creditEarned ?? null,
					creditPossible: answer.creditPossible ?? null,
					answeredAt: answer.answeredAt,
				};

				await executor
					.insert(responses)
					.values(answerRow)
					.onConflictDoNothing();
			}
		},

		async findById(id: QuizAttemptId): Promise<QuizAttempt | undefined> {
			if (!isUuid(String(id))) {
				return undefined;
			}

			return first(
				await executor
					.select()
					.from(attempts)
					.where(eq(attempts.id, String(id)))
					.limit(1),
			);
		},

		async findActiveFor(
			telegramUserId: number,
		): Promise<QuizAttempt | undefined> {
			return first(
				await executor
					.select()
					.from(attempts)
					.where(
						and(
							eq(attempts.telegramUserId, telegramUserId),
							inArray(attempts.status, [
								QuizAttemptStatus.Active,
								QuizAttemptStatus.Paused,
							]),
						),
					)
					.orderBy(asc(attempts.startedAt))
					.limit(1),
			);
		},

		async listCompletedForQuiz(
			telegramUserId: number,
			quizId: QuizSetId,
		): Promise<readonly AttemptStatistics[]> {
			const rows = await executor
				.select({
					attemptId: attempts.id,
					completedAt: attempts.completedAt,
					total: count(responses.questionId),
					correct: sql<number>`sum(case when ${responses.isCorrect} then 1 else 0 end)`,
				})
				.from(attempts)
				.leftJoin(responses, eq(responses.attemptId, attempts.id))
				.where(
					and(
						eq(attempts.quizId, String(quizId)),
						eq(attempts.telegramUserId, telegramUserId),
						eq(attempts.status, QuizAttemptStatus.Completed),
					),
				)
				.groupBy(attempts.id)
				.orderBy(asc(attempts.completedAt));

			return rows.map((row) => ({
				attemptId: toQuizAttemptId(row.attemptId),
				quizId,
				correct: Number(row.correct ?? 0),
				total: Number(row.total),
				completedAt: row.completedAt ?? undefined,
			}));
		},

		async topicAccuracy(
			telegramUserId: number,
			quizId: QuizSetId,
		): Promise<readonly TopicAccuracy[]> {
			const rows = await executor
				.select({
					topic: questions.topic,
					answered: count(responses.questionId),
					correct: sql<number>`sum(case when ${responses.isCorrect} then 1 else 0 end)`,
				})
				.from(responses)
				.innerJoin(attempts, eq(attempts.id, responses.attemptId))
				.innerJoin(questions, eq(questions.id, responses.questionId))
				.where(
					and(
						eq(attempts.quizId, String(quizId)),
						eq(attempts.telegramUserId, telegramUserId),
					),
				)
				.groupBy(questions.topic)
				.orderBy(sql`${questions.topic} is null`, asc(questions.topic));

			return rows.map((row) => ({
				topic: row.topic ?? undefined,
				answered: Number(row.answered),
				correct: Number(row.correct ?? 0),
			}));
		},

		async incorrectQuestionIds(
			telegramUserId: number,
			quizId: QuizSetId,
		): Promise<readonly QuestionId[]> {
			if (!isUuid(String(quizId))) {
				return [];
			}

			const later = alias(responses, "later");
			const laterAttempt = alias(attempts, "later_attempt");
			const rows = await executor
				.select({
					questionId: responses.questionId,
					latest: sql<string>`max(${responses.answeredAt})`.as("latest"),
				})
				.from(responses)
				.innerJoin(attempts, eq(attempts.id, responses.attemptId))
				.where(
					and(
						eq(attempts.quizId, String(quizId)),
						eq(attempts.telegramUserId, telegramUserId),
						eq(responses.isCorrect, false),
						notExists(
							executor
								.select({ present: sql`1` })
								.from(later)
								.innerJoin(laterAttempt, eq(laterAttempt.id, later.attemptId))
								.where(
									and(
										eq(laterAttempt.telegramUserId, telegramUserId),
										eq(later.questionId, responses.questionId),
										eq(later.isCorrect, true),
										gt(later.answeredAt, responses.answeredAt),
									),
								),
						),
					),
				)
				.groupBy(responses.questionId)
				.orderBy(desc(sql`latest`), asc(responses.questionId));

			return rows.map((row) => toQuestionId(row.questionId));
		},

		async answerCount(questionId: QuestionId): Promise<number> {
			if (!isUuid(String(questionId))) {
				return 0;
			}

			const [row] = await executor
				.select({ total: count() })
				.from(responses)
				.where(eq(responses.questionId, String(questionId)));

			return Number(row?.total ?? 0);
		},
	};
}
