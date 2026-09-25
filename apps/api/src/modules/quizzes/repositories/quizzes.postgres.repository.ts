import { Injectable } from "@nestjs/common";
import {
	and,
	asc,
	count,
	eq,
	getTableColumns,
	inArray,
	isNull,
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
import { isAnyUuidOf, isUuid } from "@/db/uuid";
import {
	type QuestionEntity,
	type QuestionId,
	toQuestionId,
} from "../question.entity";
import { questionFingerprint } from "../question-fingerprint";
import { isQuizSetStatus } from "../quiz-set.constants";
import { QuizSetEntity, type QuizSetId, toQuizSetId } from "../quiz-set.entity";
import { QuizVersionConflictError } from "../quizzes.errors";
import type {
	ListedQuestion,
	QuestionListFilter,
	QuestionLocation,
	QuizListFilter,
	QuizSummary,
} from "../quizzes.repository";
import { QuizzesRepository } from "../quizzes.repository";
import { CorruptedQuizRowError, toQuestion, toQuiz } from "./quiz.mapper";

type StoredQuestion = typeof questions.$inferSelect;
type StoredOption = typeof questionOptions.$inferSelect;

type QuestionWrite = Pick<
	StoredQuestion,
	| "id"
	| "ownerId"
	| "quizId"
	| "type"
	| "prompt"
	| "explanation"
	| "sourceReference"
	| "topic"
	| "difficulty"
	| "hint"
	| "vocabularyItemId"
	| "position"
	| "fingerprint"
>;

const sameRow = (row: QuestionWrite, stored: StoredQuestion): boolean =>
	(Object.keys(row) as (keyof QuestionWrite)[]).every(
		(key) => row[key] === stored[key],
	);

const groupOptions = (
	rows: readonly StoredOption[],
): ReadonlyMap<string, readonly StoredOption[]> => {
	const grouped = new Map<string, StoredOption[]>();

	for (const row of rows) {
		grouped.set(row.questionId, [...(grouped.get(row.questionId) ?? []), row]);
	}

	return grouped;
};

const sameOptions = (
	options: QuestionEntity["options"],
	stored: readonly StoredOption[],
): boolean => {
	if (options.length !== stored.length) {
		return false;
	}

	const byId = new Map(stored.map((row) => [row.id, row]));

	return options.every((option) => {
		const row = byId.get(String(option.id));

		return (
			row !== undefined &&
			row.text === option.text &&
			row.isCorrect === option.isCorrect &&
			row.matchKey === (option.matchKey ?? null) &&
			row.position === option.position
		);
	});
};

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

		await this.writeQuestions(id, quiz);

		return nextVersion;
	}

	private async writeQuestions(id: string, quiz: QuizSetEntity): Promise<void> {
		const storedRows = await this.executor
			.select()
			.from(questions)
			.where(and(this.myQuestions, eq(questions.quizId, id)));
		const storedOptions =
			storedRows.length === 0
				? []
				: await this.executor
						.select(getTableColumns(questionOptions))
						.from(questionOptions)
						.innerJoin(questions, eq(questions.id, questionOptions.questionId))
						.where(and(this.myQuestions, eq(questions.quizId, id)));
		const storedById = new Map(
			storedRows.map((row) => [row.id.toLowerCase(), row]),
		);
		const optionsOf = groupOptions(storedOptions);
		const keptIds = new Set(
			quiz.questions.map((question) => String(question.id).toLowerCase()),
		);
		const removedIds = storedRows
			.map((row) => row.id)
			.filter((questionId) => !keptIds.has(questionId.toLowerCase()));

		if (removedIds.length > 0) {
			await this.executor
				.delete(questions)
				.where(
					and(
						this.myQuestions,
						eq(questions.quizId, id),
						inArray(questions.id, removedIds),
					),
				);
		}

		const rows = quiz.questions.map((question) => ({
			question,
			row: this.questionRowOf(id, question),
			stored: storedById.get(String(question.id).toLowerCase()),
		}));
		const changedRows = rows.filter(
			({ row, stored }) => stored === undefined || !sameRow(row, stored),
		);
		const parkedIds = changedRows.flatMap(({ stored }) =>
			stored === undefined ? [] : [stored.id],
		);

		if (parkedIds.length > 0) {
			await this.executor
				.update(questions)
				.set({
					position: sql`-1 - ${questions.position}`,
					fingerprint: sql`'parked:' || ${questions.id}`,
				})
				.where(and(this.myQuestions, inArray(questions.id, parkedIds)));
		}

		for (const { row } of changedRows) {
			await this.executor
				.insert(questions)
				.values(row)
				.onConflictDoUpdate({ target: questions.id, set: row });
		}

		const reoptioned = rows
			.filter(
				({ question, stored }) =>
					stored === undefined ||
					!sameOptions(question.options, optionsOf.get(stored.id) ?? []),
			)
			.map(({ question }) => question);

		if (reoptioned.length === 0) {
			return;
		}

		await this.executor.delete(questionOptions).where(
			inArray(
				questionOptions.questionId,
				this.executor
					.select({ id: questions.id })
					.from(questions)
					.where(
						and(
							this.myQuestions,
							inArray(
								questions.id,
								reoptioned.map((question) => String(question.id)),
							),
						),
					),
			),
		);

		const optionRows = reoptioned.flatMap((question) =>
			question.options.map((option) => ({
				id: String(option.id),
				questionId: String(question.id),
				text: option.text,
				isCorrect: option.isCorrect,
				matchKey: option.matchKey ?? null,
				position: option.position,
			})),
		);

		if (optionRows.length > 0) {
			await this.executor.insert(questionOptions).values(optionRows);
		}
	}

	private questionRowOf(
		quizId: string,
		question: QuestionEntity,
	): QuestionWrite {
		return {
			id: String(question.id),
			ownerId: this.owner,
			quizId,
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

	async answerCounts(
		questionIds: readonly QuestionId[],
	): Promise<ReadonlyMap<QuestionId, number>> {
		const ids = questionIds.map(String).filter(isUuid);

		if (ids.length === 0) {
			return new Map();
		}

		const rows = await this.executor
			.select({ questionId: responses.questionId, total: count() })
			.from(responses)
			.innerJoin(attempts, eq(attempts.id, responses.attemptId))
			.where(
				and(
					eq(attempts.ownerId, this.owner),
					isAnyUuidOf(responses.questionId, ids),
				),
			)
			.groupBy(responses.questionId);

		return new Map(
			rows.map((row) => [toQuestionId(row.questionId), Number(row.total)]),
		);
	}

	async locateQuestions(
		questionIds: readonly QuestionId[],
	): Promise<readonly QuestionLocation[]> {
		const ids = questionIds.map(String).filter(isUuid);

		if (ids.length === 0) {
			return [];
		}

		const rows = await this.executor
			.select({
				questionId: questions.id,
				quizSetId: quizzes.id,
				quizSetTitle: quizzes.title,
				quizSetStatus: quizzes.status,
				prompt: questions.prompt,
			})
			.from(questions)
			.innerJoin(quizzes, eq(quizzes.id, questions.quizId))
			.where(and(this.myQuestions, this.mine, isAnyUuidOf(questions.id, ids)));

		return rows.map((row) => {
			if (!isQuizSetStatus(row.quizSetStatus)) {
				throw new CorruptedQuizRowError(row.quizSetId, [
					`status "${row.quizSetStatus}" is not supported`,
				]);
			}

			return {
				questionId: toQuestionId(row.questionId),
				quizSetId: toQuizSetId(row.quizSetId),
				quizSetTitle: row.quizSetTitle,
				quizSetStatus: row.quizSetStatus,
				prompt: row.prompt,
			};
		});
	}

	async listQuestions(
		filter?: QuestionListFilter,
	): Promise<readonly ListedQuestion[]> {
		if (filter?.quizSetId !== undefined && !isUuid(String(filter.quizSetId))) {
			return [];
		}

		const scope = and(
			this.myQuestions,
			this.mine,
			filter?.quizSetId === undefined
				? undefined
				: eq(quizzes.id, String(filter.quizSetId)),
		);
		const rows = await this.executor
			.select({ question: questions, quiz: quizzes })
			.from(questions)
			.innerJoin(quizzes, eq(quizzes.id, questions.quizId))
			.where(scope)
			.orderBy(asc(quizzes.title), asc(quizzes.id), asc(questions.position));

		if (rows.length === 0) {
			return [];
		}

		const optionRows = await this.executor
			.select(getTableColumns(questionOptions))
			.from(questionOptions)
			.innerJoin(questions, eq(questions.id, questionOptions.questionId))
			.innerJoin(quizzes, eq(quizzes.id, questions.quizId))
			.where(scope)
			.orderBy(asc(questionOptions.position));
		const optionsOf = groupOptions(optionRows);

		return rows.map(({ question, quiz }) => {
			if (!isQuizSetStatus(quiz.status)) {
				throw new CorruptedQuizRowError(quiz.id, [
					`status "${quiz.status}" is not supported`,
				]);
			}

			return {
				question: toQuestion(question, optionsOf.get(question.id) ?? []),
				quizSetId: toQuizSetId(quiz.id),
				setTitle: quiz.title,
				setStatus: quiz.status,
			};
		});
	}
}
