import { Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { reviewStates } from "@/db/schema";
import { type QuestionId, toQuestionId } from "@/modules/quizzes";
import { ScheduleEntity } from "@/modules/scheduling";

type ReviewRow = typeof reviewStates.$inferSelect;

const toSchedule = (row: ReviewRow): ScheduleEntity => ({
	questionId: toQuestionId(row.questionId),
	telegramUserId: row.telegramUserId ?? undefined,
	repetitionCount: row.repetitionCount,
	lapses: row.lapses,
	lastCompletedAt: row.lastReviewedAt ?? row.updatedAt,
	dueAt: row.dueAt ?? undefined,
	stability: row.stability === null ? undefined : Number(row.stability),
	difficulty: row.difficulty === null ? undefined : Number(row.difficulty),
});

import { OwnerContext } from "@/core/owner-context";
import { Database } from "@/db/connection";
import { DatabaseExecutor } from "@/db/executor";
import { SchedulesRepository } from "../scheduling.repository";

@Injectable()
export class PostgresSchedulesRepository extends SchedulesRepository {
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
		return eq(reviewStates.ownerId, this.owner);
	}

	async saveSchedules(schedules: readonly ScheduleEntity[]): Promise<void> {
		for (const schedule of schedules) {
			const row = {
				questionId: String(schedule.questionId),
				ownerId: this.owner,
				telegramUserId: schedule.telegramUserId ?? null,
				repetitionCount: schedule.repetitionCount,
				lapses: schedule.lapses,
				lastReviewedAt: schedule.lastCompletedAt,
				dueAt: schedule.dueAt ?? null,
				stability:
					schedule.stability === undefined ? null : String(schedule.stability),
				difficulty:
					schedule.difficulty === undefined
						? null
						: String(schedule.difficulty),
				updatedAt: schedule.lastCompletedAt,
			};

			await this.executor
				.insert(reviewStates)
				.values(row)
				.onConflictDoUpdate({ target: reviewStates.questionId, set: row });
		}
	}

	async findSchedules(
		questionIds: readonly QuestionId[],
	): Promise<readonly ScheduleEntity[]> {
		if (questionIds.length === 0) {
			return [];
		}

		const rows = await this.executor
			.select()
			.from(reviewStates)
			.where(
				and(
					this.mine,
					inArray(reviewStates.questionId, questionIds.map(String)),
				),
			);

		return rows.map(toSchedule);
	}

	async listDue(at: Date): Promise<readonly ScheduleEntity[]> {
		const rows = await this.executor
			.select()
			.from(reviewStates)
			.where(and(this.mine, lte(reviewStates.dueAt, at)))
			.orderBy(asc(reviewStates.dueAt));

		return rows.map(toSchedule);
	}

	async listLeeches(threshold: number): Promise<readonly ScheduleEntity[]> {
		const rows = await this.executor
			.select()
			.from(reviewStates)
			.where(and(this.mine, sql`${reviewStates.lapses} >= ${threshold}`))
			.orderBy(sql`${reviewStates.lapses} desc`);

		return rows.map(toSchedule);
	}
}
