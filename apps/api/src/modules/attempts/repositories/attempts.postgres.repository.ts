import { Injectable } from "@nestjs/common";
import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	inArray,
	lte,
	notExists,
	type SQL,
	sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { OwnerContext } from "@/core/owner-context";
import { Database } from "@/db/connection";
import { DatabaseExecutor } from "@/db/executor";
import { attemptQuestions, attempts, questions, responses } from "@/db/schema";
import { isUuid } from "@/db/uuid";
import {
	type QuestionId,
	type QuizSetId,
	toQuestionId,
	toQuestionOptionId,
	toQuizSetId,
} from "@/modules/quizzes";
import { RecallGrade } from "@/modules/scheduling";
import { AttemptEntity, toQuizAttemptId } from "../attempt.entity";
import { type QuizAttemptId } from "../attempt.entity.types";
import {
	isQuizAttemptMode,
	isQuizAttemptStatus,
	QuizAttemptStatus,
} from "../attempts.constants";
import {
	type AttemptStatistics,
	AttemptsRepository,
	type TopicAccuracy,
} from "../attempts.repository";

type AttemptRow = typeof attempts.$inferSelect;

const sameOrder = (
	left: readonly string[],
	right: readonly string[],
): boolean =>
	left.length === right.length &&
	left.every((entry, index) => entry === right[index]);

export class CorruptedAttemptRowError extends Error {
	constructor(id: string, issue: string) {
		super(`Attempt ${id} cannot be read: ${issue}`);
		this.name = "CorruptedAttemptRowError";
	}
}

@Injectable()
export class PostgresAttemptsRepository extends AttemptsRepository {
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
		return eq(attempts.ownerId, this.owner);
	}

	private async hydrate(row: AttemptRow): Promise<AttemptEntity> {
		if (!isQuizAttemptMode(row.mode)) {
			throw new CorruptedAttemptRowError(row.id, `mode "${row.mode}"`);
		}

		if (!isQuizAttemptStatus(row.status)) {
			throw new CorruptedAttemptRowError(row.id, `status "${row.status}"`);
		}

		const planned = await this.executor
			.select({ questionId: attemptQuestions.questionId })
			.from(attemptQuestions)
			.where(eq(attemptQuestions.attemptId, row.id))
			.orderBy(asc(attemptQuestions.position));

		const answers = await this.executor
			.select()
			.from(responses)
			.where(eq(responses.attemptId, row.id))
			.orderBy(asc(responses.answeredAt));

		return AttemptEntity.restore({
			id: toQuizAttemptId(row.id),
			quizSetId: toQuizSetId(row.quizId),
			telegramUserId: row.telegramUserId ?? undefined,
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
				recall: (answer.recall ?? undefined) as RecallGrade | undefined,
			})),
			startedAt: row.startedAt,
			updatedAt: row.updatedAt,
			completedAt: row.completedAt ?? undefined,
		});
	}

	private async first(
		rows: readonly AttemptRow[],
	): Promise<AttemptEntity | undefined> {
		const [row] = rows;

		return row === undefined ? undefined : this.hydrate(row);
	}

	async save(attempt: AttemptEntity): Promise<void> {
		const id = String(attempt.id);
		const row = {
			id,
			quizId: String(attempt.quizSetId),
			ownerId: this.owner,
			telegramUserId: attempt.telegramUserId ?? null,
			mode: attempt.mode,
			status: attempt.status,
			startedAt: attempt.startedAt,
			updatedAt: attempt.updatedAt,
			completedAt: attempt.completedAt ?? null,
		};

		const [written] = await this.executor
			.insert(attempts)
			.values(row)
			.onConflictDoUpdate({
				target: attempts.id,
				set: row,
				setWhere: and(
					this.mine,
					lte(attempts.updatedAt, sql`excluded.updated_at`),
				),
			})
			.returning({ inserted: sql<boolean>`(xmax = 0)` });

		if (written === undefined) {
			return;
		}

		const stored = written.inserted
			? { plan: [], recalls: new Map<string, string | null>() }
			: await this.storedChildrenOf(id);
		const plan = attempt.questionIds.map(String);

		if (!sameOrder(stored.plan, plan)) {
			await this.replacePlan(id, stored.plan.length > 0, plan);
		}

		const fresh = attempt.responses.filter(
			(answer) => !stored.recalls.has(String(answer.questionId)),
		);

		if (fresh.length > 0) {
			await this.executor
				.insert(responses)
				.values(fresh.map((answer) => this.responseRowOf(id, answer)))
				.onConflictDoNothing();
		}

		for (const answer of attempt.responses) {
			const questionId = String(answer.questionId);
			const recall = answer.recall ?? null;

			if (
				!stored.recalls.has(questionId) ||
				stored.recalls.get(questionId) === recall
			) {
				continue;
			}

			await this.executor
				.update(responses)
				.set({ recall })
				.where(
					and(
						eq(responses.attemptId, id),
						eq(responses.questionId, questionId),
					),
				);
		}
	}

	private async storedChildrenOf(id: string): Promise<{
		readonly plan: readonly string[];
		readonly recalls: ReadonlyMap<string, string | null>;
	}> {
		const plan = await this.executor
			.select({ questionId: attemptQuestions.questionId })
			.from(attemptQuestions)
			.where(eq(attemptQuestions.attemptId, id))
			.orderBy(asc(attemptQuestions.position));
		const answers = await this.executor
			.select({ questionId: responses.questionId, recall: responses.recall })
			.from(responses)
			.where(eq(responses.attemptId, id));

		return {
			plan: plan.map((entry) => entry.questionId),
			recalls: new Map(
				answers.map((answer) => [answer.questionId, answer.recall]),
			),
		};
	}

	private async replacePlan(
		id: string,
		existed: boolean,
		plan: readonly string[],
	): Promise<void> {
		if (existed) {
			await this.executor
				.delete(attemptQuestions)
				.where(eq(attemptQuestions.attemptId, id));
		}

		await this.executor.insert(attemptQuestions).values(
			plan.map((questionId, position) => ({
				attemptId: id,
				position,
				questionId,
			})),
		);
	}

	private responseRowOf(
		id: string,
		answer: AttemptEntity["responses"][number],
	) {
		return {
			attemptId: id,
			questionId: String(answer.questionId),
			selectedOptionIds: answer.selectedOptionIds.map(String),
			isCorrect: answer.isCorrect,
			typedAnswer: answer.typedAnswer ?? null,
			skipped: answer.skipped ?? false,
			creditEarned: answer.creditEarned ?? null,
			creditPossible: answer.creditPossible ?? null,
			recall: answer.recall ?? null,
			answeredAt: answer.answeredAt,
		};
	}

	async findById(id: QuizAttemptId): Promise<AttemptEntity | undefined> {
		if (!isUuid(String(id))) {
			return undefined;
		}

		return this.heldOne(eq(attempts.id, String(id)));
	}

	async findActive(): Promise<AttemptEntity | undefined> {
		return this.heldOne(
			inArray(attempts.status, [
				QuizAttemptStatus.Active,
				QuizAttemptStatus.Paused,
			]),
		);
	}

	private async heldOne(condition: SQL): Promise<AttemptEntity | undefined> {
		const query = this.executor
			.select()
			.from(attempts)
			.where(and(this.mine, condition))
			.orderBy(asc(attempts.startedAt))
			.$dynamic();

		return this.first(
			await (DatabaseExecutor.isOpen() ? query.for("update") : query),
		);
	}

	async listCompletedForQuiz(
		quizId: QuizSetId,
	): Promise<readonly AttemptStatistics[]> {
		const rows = await this.executor
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
					this.mine,
					eq(attempts.quizId, String(quizId)),
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
	}

	async topicAccuracy(quizId: QuizSetId): Promise<readonly TopicAccuracy[]> {
		const rows = await this.executor
			.select({
				topic: questions.topic,
				answered: count(responses.questionId),
				correct: sql<number>`sum(case when ${responses.isCorrect} then 1 else 0 end)`,
			})
			.from(responses)
			.innerJoin(attempts, eq(attempts.id, responses.attemptId))
			.innerJoin(questions, eq(questions.id, responses.questionId))
			.where(and(this.mine, eq(attempts.quizId, String(quizId))))
			.groupBy(questions.topic)
			.orderBy(sql`${questions.topic} is null`, asc(questions.topic));

		return rows.map((row) => ({
			topic: row.topic ?? undefined,
			answered: Number(row.answered),
			correct: Number(row.correct ?? 0),
		}));
	}

	async incorrectQuestionIds(
		quizId: QuizSetId,
	): Promise<readonly QuestionId[]> {
		if (!isUuid(String(quizId))) {
			return [];
		}

		const later = alias(responses, "later");
		const laterAttempt = alias(attempts, "later_attempt");
		const rows = await this.executor
			.select({
				questionId: responses.questionId,
				latest: sql<string>`max(${responses.answeredAt})`.as("latest"),
			})
			.from(responses)
			.innerJoin(attempts, eq(attempts.id, responses.attemptId))
			.where(
				and(
					this.mine,
					eq(attempts.quizId, String(quizId)),
					eq(responses.isCorrect, false),
					notExists(
						this.executor
							.select({ present: sql`1` })
							.from(later)
							.innerJoin(laterAttempt, eq(laterAttempt.id, later.attemptId))
							.where(
								and(
									eq(laterAttempt.ownerId, this.owner),
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
	}

	async delete(id: QuizAttemptId): Promise<void> {
		if (!isUuid(String(id))) {
			return;
		}

		await this.executor
			.delete(attempts)
			.where(and(this.mine, eq(attempts.id, String(id))));
	}

	async answerCount(questionId: QuestionId): Promise<number> {
		if (!isUuid(String(questionId))) {
			return 0;
		}

		const [row] = await this.executor
			.select({ total: count() })
			.from(responses)
			.innerJoin(attempts, eq(attempts.id, responses.attemptId))
			.where(and(this.mine, eq(responses.questionId, String(questionId))));

		return Number(row?.total ?? 0);
	}
}
