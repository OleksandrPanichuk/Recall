import { Injectable } from "@nestjs/common";
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
import { OwnerContext } from "@/core/owner-context";
import { Database } from "@/db/connection";
import { DatabaseExecutor } from "@/db/executor";
import {
	attempts,
	questionOptions,
	questions,
	quizzes,
	responses,
} from "@/db/schema";
import { isUuid } from "@/db/uuid";
import type { QuestionId } from "../question.entity";
import { questionFingerprint } from "../question-fingerprint";
import { QuizSetEntity, type QuizSetId, toQuizSetId } from "../quiz-set.entity";
import { QuizVersionConflictError } from "../quizzes.errors";
import type { QuizListFilter, QuizSummary } from "../quizzes.repository";
import { QuizzesRepository } from "../quizzes.repository";
import { toQuiz } from "./quiz.mapper";

@Injectable()
export class PostgresQuizzesRepository extends QuizzesRepository {
	constructor(
		private readonly database: Database,
		private readonly owners: OwnerContext,
	) {
		super();
	}

	private get executor() {
		return DatabaseExecutor.for(this.database.db);
	}

	private get owner() {
		return this.owners.current();
	}

	private get mine() {
		return eq(quizzes.ownerId, this.owner);
	}

	private get myQuestions() {
		return eq(questions.ownerId, this.owner);
	}

	private async currentVersion(id: string): Promise<number | undefined> {
		if (!isUuid(id)) {
			return undefined;
		}

		const [row] = await this.executor
			.select({ version: quizzes.version })
			.from(quizzes)
			.where(and(this.mine, eq(quizzes.id, id)))
			.limit(1);

		return row?.version;
	}

	async versionOf(id: QuizSetId): Promise<number | undefined> {
		return this.currentVersion(String(id));
	}

	async save(quiz: QuizSetEntity, expectedVersion?: number): Promise<number> {
		const id = String(quiz.id);
		const stored = await this.currentVersion(id);

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
			ownerId: this.owner,
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

		await this.executor
			.insert(quizzes)
			.values(row)
			.onConflictDoUpdate({ target: quizzes.id, set: row });

		const keptIds = quiz.questions.map((question) => String(question.id));

		await this.executor
			.delete(questions)
			.where(
				and(
					this.myQuestions,
					eq(questions.quizId, id),
					keptIds.length === 0 ? undefined : notInArray(questions.id, keptIds),
				),
			);

		await this.executor
			.update(questions)
			.set({
				position: sql`-1 - ${questions.position}`,
				fingerprint: sql`'parked:' || ${questions.id}`,
			})
			.where(and(this.myQuestions, eq(questions.quizId, id)));

		for (const question of quiz.questions) {
			const questionRow = {
				id: String(question.id),
				ownerId: this.owner,
				quizId: id,
				type: question.type,
				prompt: question.prompt,
				explanation: question.explanation ?? null,
				sourceReference: question.sourceReference ?? null,
				topic: question.topic ?? null,
				difficulty: question.difficulty,
				hint: question.hint ?? null,
				vocabularyItemId: question.vocabularyItemId ?? null,
				position: question.position,
				fingerprint: questionFingerprint(question),
			};

			await this.executor
				.insert(questions)
				.values(questionRow)
				.onConflictDoUpdate({ target: questions.id, set: questionRow });

			await this.executor
				.delete(questionOptions)
				.where(eq(questionOptions.questionId, String(question.id)));

			if (question.options.length > 0) {
				await this.executor.insert(questionOptions).values(
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
	}

	async findById(id: QuizSetId): Promise<QuizSetEntity | undefined> {
		if (!isUuid(String(id))) {
			return undefined;
		}

		const [row] = await this.executor
			.select()
			.from(quizzes)
			.where(and(this.mine, eq(quizzes.id, String(id))))
			.limit(1);

		if (row === undefined) {
			return undefined;
		}

		const questionRows = await this.executor
			.select()
			.from(questions)
			.where(and(this.myQuestions, eq(questions.quizId, String(id))))
			.orderBy(asc(questions.position));

		const optionRows =
			questionRows.length === 0
				? []
				: await this.executor
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
	}

	async list(filter?: QuizListFilter): Promise<readonly QuizSummary[]> {
		const conditions = [this.mine];

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

		if (filter?.ids !== undefined) {
			const ids = filter.ids.map(String).filter(isUuid);

			if (ids.length === 0) {
				return [];
			}

			conditions.push(inArray(quizzes.id, ids));
		}

		const rows = await this.executor
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
	}

	async answerCount(questionId: QuestionId): Promise<number> {
		if (!isUuid(String(questionId))) {
			return 0;
		}

		const [row] = await this.executor
			.select({ total: count() })
			.from(responses)
			.innerJoin(attempts, eq(attempts.id, responses.attemptId))
			.where(
				and(
					eq(attempts.ownerId, this.owner),
					eq(responses.questionId, String(questionId)),
				),
			);

		return Number(row?.total ?? 0);
	}
}
