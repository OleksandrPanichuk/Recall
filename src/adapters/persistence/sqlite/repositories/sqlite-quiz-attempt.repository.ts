import {
	aliasedTable,
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	inArray,
	notExists,
	notInArray,
	sql,
} from "drizzle-orm";
import type {
	AttemptStatistics,
	QuizAttemptRepository,
	TopicAccuracy,
} from "@/application/ports/repositories/quiz-attempt.repository";
import type { Transaction } from "@/application/ports/transaction";
import {
	type QuizAttempt,
	type QuizAttemptId,
	QuizAttemptStatus,
	toQuizAttemptId,
} from "@/domain/quiz-attempt/quiz-attempt";
import { type QuestionId, toQuestionId } from "@/domain/quiz-set/question";
import { type QuizSetId, toQuizSetId } from "@/domain/quiz-set/quiz-set";
import type { QuizDatabase } from "../database";
import { questionResponses, questions, quizAttempts } from "../schema";
import {
	plannedQuestionIds,
	toQuestionResponseRows,
	toQuizAttempt,
	toQuizAttemptRow,
	toTopicAccuracy,
} from "./quiz-attempt.mapper";
import type { QuizAttemptRow } from "./quiz-attempt.mapper.types";

const unfinishedStatuses = [QuizAttemptStatus.Active, QuizAttemptStatus.Paused];

export function createSqliteQuizAttemptRepository(
	database: QuizDatabase,
	transaction: Transaction,
): QuizAttemptRepository {
	const responsesOf = (attemptIds: readonly string[]) =>
		attemptIds.length === 0
			? []
			: database
					.select()
					.from(questionResponses)
					.where(inArray(questionResponses.attemptId, [...attemptIds]))
					.all();

	const restore = (row: QuizAttemptRow): QuizAttempt =>
		toQuizAttempt(row, responsesOf([row.id]));

	return {
		save(attempt: QuizAttempt): void {
			const row = toQuizAttemptRow(attempt);
			const plannedIds = attempt.questionIds.map((id) => String(id));

			transaction.run(() => {
				const stored = database
					.select({ updatedAt: quizAttempts.updatedAt })
					.from(quizAttempts)
					.where(eq(quizAttempts.id, row.id))
					.get();

				// Applying a stale copy would rewind updated_at past answers already
				// stored — they are append-only and stay — leaving a row the restore
				// factory rejects, so the attempt could never be read again.
				if (stored && stored.updatedAt > row.updatedAt) {
					return;
				}

				database
					.insert(quizAttempts)
					.values(row)
					.onConflictDoUpdate({ target: quizAttempts.id, set: row })
					.run();

				database
					.delete(questionResponses)
					.where(
						plannedIds.length === 0
							? eq(questionResponses.attemptId, row.id)
							: and(
									eq(questionResponses.attemptId, row.id),
									notInArray(questionResponses.questionId, plannedIds),
								),
					)
					.run();

				const responseRows = toQuestionResponseRows(attempt);

				if (responseRows.length > 0) {
					database
						.insert(questionResponses)
						.values([...responseRows])
						.onConflictDoNothing()
						.run();
				}
			});
		},

		findById(id: QuizAttemptId): QuizAttempt | undefined {
			const row = database
				.select()
				.from(quizAttempts)
				.where(eq(quizAttempts.id, id))
				.get();

			return row ? restore(row) : undefined;
		},

		findActiveByUser(telegramUserId: number): QuizAttempt | undefined {
			const row = database
				.select()
				.from(quizAttempts)
				.where(
					and(
						eq(quizAttempts.telegramUserId, telegramUserId),
						inArray(quizAttempts.status, unfinishedStatuses),
					),
				)
				.orderBy(desc(quizAttempts.updatedAt), asc(quizAttempts.id))
				.limit(1)
				.get();

			return row ? restore(row) : undefined;
		},

		listCompletedBySet(
			telegramUserId: number,
			quizSetId: QuizSetId,
		): readonly AttemptStatistics[] {
			const rows = database
				.select()
				.from(quizAttempts)
				.where(
					and(
						eq(quizAttempts.telegramUserId, telegramUserId),
						eq(quizAttempts.quizSetId, quizSetId),
						eq(quizAttempts.status, QuizAttemptStatus.Completed),
					),
				)
				.orderBy(asc(quizAttempts.startedAt), asc(quizAttempts.id))
				.all();
			const responses = responsesOf(rows.map((row) => row.id));

			return rows.map((row): AttemptStatistics => {
				const planned = new Set(plannedQuestionIds(row).map(String));

				return {
					attemptId: toQuizAttemptId(row.id),
					quizSetId: toQuizSetId(row.quizSetId),
					correct: responses.filter(
						(response) =>
							response.attemptId === row.id &&
							response.isCorrect &&
							planned.has(response.questionId),
					).length,
					total: planned.size,
					completedAt:
						row.completedAt === null ? undefined : new Date(row.completedAt),
				};
			});
		},

		topicAccuracy(telegramUserId: number): readonly TopicAccuracy[] {
			const rows = database
				.select({
					topic: questions.topic,
					answered: count(),
					// count() ignores NULLs, so this counts the right answers without CASE.
					correct: count(sql`nullif(${questionResponses.isCorrect}, 0)`),
				})
				.from(questionResponses)
				.innerJoin(
					quizAttempts,
					eq(quizAttempts.id, questionResponses.attemptId),
				)
				.innerJoin(questions, eq(questions.id, questionResponses.questionId))
				.where(eq(quizAttempts.telegramUserId, telegramUserId))
				.groupBy(questions.topic)
				.orderBy(sql`${questions.topic} is null`, asc(questions.topic))
				.all();

			return rows.map(toTopicAccuracy);
		},

		incorrectQuestionIds(telegramUserId: number): readonly QuestionId[] {
			const later = aliasedTable(questionResponses, "later");
			const laterAttempt = aliasedTable(quizAttempts, "later_attempt");

			const rows = database
				.select({
					questionId: questionResponses.questionId,
					latest: sql<string>`max(${questionResponses.answeredAt})`.as(
						"latest",
					),
				})
				.from(questionResponses)
				.innerJoin(
					quizAttempts,
					eq(quizAttempts.id, questionResponses.attemptId),
				)
				.where(
					and(
						eq(quizAttempts.telegramUserId, telegramUserId),
						eq(questionResponses.isCorrect, false),
						notExists(
							database
								.select({ present: sql`1` })
								.from(later)
								.innerJoin(laterAttempt, eq(laterAttempt.id, later.attemptId))
								.where(
									and(
										eq(laterAttempt.telegramUserId, telegramUserId),
										eq(later.questionId, questionResponses.questionId),
										eq(later.isCorrect, true),
										gt(later.answeredAt, questionResponses.answeredAt),
									),
								),
						),
					),
				)
				.groupBy(questionResponses.questionId)
				.orderBy(desc(sql`latest`), asc(questionResponses.questionId))
				.all();

			return rows.map((row) => toQuestionId(row.questionId));
		},
	};
}
