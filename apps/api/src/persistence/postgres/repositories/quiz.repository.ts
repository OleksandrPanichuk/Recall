import {
	and,
	asc,
	count,
	eq,
	inArray,
	isNull,
	notInArray,
	sql,
} from "drizzle-orm";
import type { OwnerId } from "@/application/ports/owner";
import type {
	QuizListFilter,
	QuizRepository,
	QuizSummary,
} from "@/application/ports/repositories/quiz.repository";
import { QuizVersionConflictError } from "@/application/ports/repositories/quiz.repository";
import { questionFingerprint } from "@/domain/quiz-set/question-fingerprint";
import type { QuizSet, QuizSetId } from "@/domain/quiz-set/quiz-set";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { questionOptions, questions, quizzes } from "../schema";
import type { Executor } from "../unit-of-work";
import { isUuid } from "../uuid";
import { toQuiz } from "./quiz.mapper";

export function createQuizPostgresRepository(
	executor: Executor,
	owner: OwnerId,
): QuizRepository {
	const mine = eq(quizzes.ownerId, owner);
	const myQuestions = eq(questions.ownerId, owner);
	const currentVersion = async (id: string): Promise<number | undefined> => {
		if (!isUuid(id)) {
			return undefined;
		}

		const [row] = await executor
			.select({ version: quizzes.version })
			.from(quizzes)
			.where(and(mine, eq(quizzes.id, id)))
			.limit(1);

		return row?.version;
	};

	return {
		async versionOf(id: QuizSetId): Promise<number | undefined> {
			return currentVersion(String(id));
		},

		async save(quiz: QuizSet, expectedVersion?: number): Promise<number> {
			const id = String(quiz.id);
			const stored = await currentVersion(id);

			if (
				expectedVersion !== undefined &&
				stored !== undefined &&
				stored !== expectedVersion
			) {
				throw new QuizVersionConflictError(quiz.id);
			}

			const nextVersion = (stored ?? -1) + 1;
			const row = {
				id,
				ownerId: owner,
				pageId: quiz.folderId === undefined ? null : String(quiz.folderId),
				title: quiz.title,
				description: quiz.description ?? null,
				language: quiz.language,
				source: quiz.source ?? null,
				sourceChapters: quiz.sourceChapters ?? null,
				tags: [...quiz.tags],
				status: quiz.status,
				version: nextVersion,
				createdAt: quiz.createdAt,
				updatedAt: quiz.updatedAt,
				publishedAt: quiz.publishedAt ?? null,
				archivedAt: quiz.archivedAt ?? null,
			};

			await executor
				.insert(quizzes)
				.values(row)
				.onConflictDoUpdate({ target: quizzes.id, set: row });

			const keptIds = quiz.questions.map((question) => String(question.id));

			await executor
				.delete(questions)
				.where(
					and(
						myQuestions,
						eq(questions.quizId, id),
						keptIds.length === 0
							? undefined
							: notInArray(questions.id, keptIds),
					),
				);

			await executor
				.update(questions)
				.set({
					position: sql`-1 - ${questions.position}`,
					fingerprint: sql`'parked:' || ${questions.id}`,
				})
				.where(and(myQuestions, eq(questions.quizId, id)));

			for (const question of quiz.questions) {
				const questionRow = {
					id: String(question.id),
					ownerId: owner,
					quizId: id,
					type: question.type,
					prompt: question.prompt,
					explanation: question.explanation ?? null,
					sourceReference: question.sourceReference ?? null,
					topic: question.topic ?? null,
					difficulty: question.difficulty,
					hint: question.hint ?? null,
					position: question.position,
					fingerprint: questionFingerprint(question),
				};

				await executor
					.insert(questions)
					.values(questionRow)
					.onConflictDoUpdate({ target: questions.id, set: questionRow });

				await executor
					.delete(questionOptions)
					.where(eq(questionOptions.questionId, String(question.id)));

				if (question.options.length > 0) {
					await executor.insert(questionOptions).values(
						question.options.map((option) => ({
							id: String(option.id),
							questionId: String(question.id),
							text: option.text,
							isCorrect: option.isCorrect,
							matchKey: option.matchKey ?? null,
							position: option.position,
						})),
					);
				}
			}

			return nextVersion;
		},

		async findById(id: QuizSetId): Promise<QuizSet | undefined> {
			if (!isUuid(String(id))) {
				return undefined;
			}

			const [row] = await executor
				.select()
				.from(quizzes)
				.where(and(mine, eq(quizzes.id, String(id))))
				.limit(1);

			if (row === undefined) {
				return undefined;
			}

			const questionRows = await executor
				.select()
				.from(questions)
				.where(and(myQuestions, eq(questions.quizId, String(id))))
				.orderBy(asc(questions.position));

			const optionRows =
				questionRows.length === 0
					? []
					: await executor
							.select()
							.from(questionOptions)
							.where(
								inArray(
									questionOptions.questionId,
									questionRows.map((question) => question.id),
								),
							)
							.orderBy(asc(questionOptions.position));

			return toQuiz(row, questionRows, optionRows);
		},

		async list(filter?: QuizListFilter): Promise<readonly QuizSummary[]> {
			const conditions = [mine];

			if (filter?.statuses !== undefined) {
				conditions.push(inArray(quizzes.status, [...filter.statuses]));
			}

			if (filter?.pageId === null) {
				conditions.push(isNull(quizzes.pageId));
			} else if (filter?.pageId !== undefined) {
				if (!isUuid(String(filter.pageId))) {
					return [];
				}

				conditions.push(eq(quizzes.pageId, String(filter.pageId)));
			}

			const rows = await executor
				.select({
					id: quizzes.id,
					title: quizzes.title,
					status: quizzes.status,
					updatedAt: quizzes.updatedAt,
					questionCount: count(questions.id),
				})
				.from(quizzes)
				.leftJoin(questions, eq(questions.quizId, quizzes.id))
				.where(and(...conditions))
				.groupBy(quizzes.id)
				.orderBy(asc(quizzes.title));

			return rows.map((row) => ({
				id: toQuizSetId(row.id),
				title: row.title,
				status: row.status as QuizSummary["status"],
				questionCount: Number(row.questionCount),
				updatedAt: row.updatedAt,
			}));
		},
	};
}
