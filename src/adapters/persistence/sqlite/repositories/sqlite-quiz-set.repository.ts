import {
	and,
	asc,
	count,
	desc,
	eq,
	inArray,
	notInArray,
	sql,
} from "drizzle-orm";
import type {
	QuizSetListFilter,
	QuizSetRepository,
	QuizSetSummary,
} from "@/application/ports/repositories/quiz-set.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { QuizSet, QuizSetId } from "@/domain/quiz-set/quiz-set";
import type { QuizDatabase } from "../database";
import { questionOptions, questions, quizSets } from "../schema";
import {
	toQuestionOptionRows,
	toQuestionRow,
	toQuizSet,
	toQuizSetRow,
	toQuizSetSummary,
} from "./quiz-set.mapper";

export function createSqliteQuizSetRepository(
	database: QuizDatabase,
	transaction: Transaction,
): QuizSetRepository {
	const questionIdsOf = (quizSetId: string): string[] =>
		database
			.select({ id: questions.id })
			.from(questions)
			.where(eq(questions.quizSetId, quizSetId))
			.all()
			.map((row) => row.id);

	return {
		save(quizSet: QuizSet): void {
			const row = toQuizSetRow(quizSet);
			const keptIds = quizSet.questions.map((question) => String(question.id));

			transaction.run(() => {
				database
					.insert(quizSets)
					.values(row)
					.onConflictDoUpdate({ target: quizSets.id, set: row })
					.run();

				// Options are rewritten wholesale: nothing references them, so there is
				// no cascade to lose.
				const storedQuestionIds = questionIdsOf(row.id);

				if (storedQuestionIds.length > 0) {
					database
						.delete(questionOptions)
						.where(inArray(questionOptions.questionId, storedQuestionIds))
						.run();
				}

				// Questions are upserted rather than deleted and reinserted so that
				// saving a set again never cascades away the attempt responses
				// pointing at the surviving questions. The trade-off is that editing a
				// stored question keeps the responses recorded against its previous
				// wording; losing them to a cascade is the worse of the two, and
				// published questions are immutable anyway.
				database
					.delete(questions)
					.where(
						keptIds.length === 0
							? eq(questions.quizSetId, row.id)
							: and(
									eq(questions.quizSetId, row.id),
									notInArray(questions.id, keptIds),
								),
					)
					.run();

				// Position and fingerprint are unique per set and SQLite checks both per
				// statement, so upserting in aggregate order would collide whenever a
				// question takes a value another surviving question still holds —
				// inserting into the middle of a set, or reordering two questions.
				// Parking every survivor outside the unique space first keeps any
				// permutation writable.
				database
					.update(questions)
					.set({
						position: sql`-1 - ${questions.position}`,
						fingerprint: sql`'parked:' || ${questions.id}`,
					})
					.where(eq(questions.quizSetId, row.id))
					.run();

				for (const question of quizSet.questions) {
					const questionRow = toQuestionRow(row.id, question);

					database
						.insert(questions)
						.values(questionRow)
						.onConflictDoUpdate({ target: questions.id, set: questionRow })
						.run();

					const optionRows = toQuestionOptionRows(question);

					if (optionRows.length > 0) {
						database
							.insert(questionOptions)
							.values([...optionRows])
							.run();
					}
				}
			});
		},

		findById(id: QuizSetId): QuizSet | undefined {
			const row = database
				.select()
				.from(quizSets)
				.where(eq(quizSets.id, id))
				.get();

			if (!row) {
				return undefined;
			}

			const questionRows = database
				.select()
				.from(questions)
				.where(eq(questions.quizSetId, id))
				.orderBy(asc(questions.position))
				.all();
			const optionRows = database
				.select({
					id: questionOptions.id,
					questionId: questionOptions.questionId,
					text: questionOptions.text,
					isCorrect: questionOptions.isCorrect,
					position: questionOptions.position,
				})
				.from(questionOptions)
				.innerJoin(questions, eq(questions.id, questionOptions.questionId))
				.where(eq(questions.quizSetId, id))
				.orderBy(asc(questionOptions.position))
				.all();

			return toQuizSet(row, questionRows, optionRows);
		},

		list(filter?: QuizSetListFilter): readonly QuizSetSummary[] {
			const summaries = database
				.select({
					id: quizSets.id,
					title: quizSets.title,
					status: quizSets.status,
					updatedAt: quizSets.updatedAt,
					questionCount: count(questions.id),
				})
				.from(quizSets)
				.leftJoin(questions, eq(questions.quizSetId, quizSets.id))
				.where(
					filter?.statuses === undefined
						? undefined
						: inArray(quizSets.status, [...filter.statuses]),
				)
				.groupBy(quizSets.id)
				.orderBy(desc(quizSets.updatedAt), asc(quizSets.id))
				.all();

			return summaries.map(toQuizSetSummary);
		},
	};
}
