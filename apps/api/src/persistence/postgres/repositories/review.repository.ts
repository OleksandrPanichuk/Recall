import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import type { OwnerId } from "@/application/ports/owner";
import type {
	ReviewRepository,
	SettingsScope,
} from "@/application/ports/repositories/review.repository";
import { type QuestionId, toQuestionId } from "@/domain/quiz-set/question";
import type { RepetitionSchedule } from "@/domain/repetition/repetition";
import type { QuizSettings } from "@/domain/settings/quiz-settings";
import { createQuizSettings } from "@/domain/settings/quiz-settings";
import { reviewStates, studySettings } from "../schema";
import type { Executor } from "../unit-of-work";

type ReviewRow = typeof reviewStates.$inferSelect;
type SettingsRow = typeof studySettings.$inferSelect;

const toSchedule = (row: ReviewRow): RepetitionSchedule => ({
	questionId: toQuestionId(row.questionId),
	telegramUserId: row.telegramUserId ?? undefined,
	repetitionCount: row.repetitionCount,
	lapses: row.lapses,
	lastCompletedAt: row.lastReviewedAt ?? row.updatedAt,
	dueAt: row.dueAt ?? undefined,
	stability: row.stability === null ? undefined : Number(row.stability),
	difficulty: row.difficulty === null ? undefined : Number(row.difficulty),
});

const toSettings = (row: SettingsRow): QuizSettings =>
	createQuizSettings({
		repetition: {
			scheduler: row.scheduler === "fsrs" ? "fsrs" : "ladder",
			intervalsDays: row.intervalsDays,
			maxIntervalDays: row.maxIntervalDays,
			maxRepetitions: row.maxRepetitions,
			desiredRetention: Number(row.desiredRetention),
		},
		shuffleOptions: row.shuffleOptions,
		shuffleQuestions: row.shuffleQuestions,
		examMode: row.examMode,
	});

const scopeMatch = (scope: SettingsScope, owner: OwnerId) =>
	and(
		eq(studySettings.ownerId, owner),
		scope.kind === "owner"
			? and(eq(studySettings.scopeType, "owner"), isNull(studySettings.scopeId))
			: and(
					eq(studySettings.scopeType, "quiz"),
					eq(studySettings.scopeId, String(scope.quizId)),
				),
	);

const scopeId = (scope: SettingsScope): string | null =>
	scope.kind === "owner" ? null : String(scope.quizId);

export function createReviewPostgresRepository(
	executor: Executor,
	owner: OwnerId,
): ReviewRepository {
	const mine = eq(reviewStates.ownerId, owner);

	return {
		async saveSchedules(
			schedules: readonly RepetitionSchedule[],
		): Promise<void> {
			for (const schedule of schedules) {
				const row = {
					questionId: String(schedule.questionId),
					ownerId: owner,
					telegramUserId: schedule.telegramUserId ?? null,
					repetitionCount: schedule.repetitionCount,
					lapses: schedule.lapses,
					lastReviewedAt: schedule.lastCompletedAt,
					dueAt: schedule.dueAt ?? null,
					stability:
						schedule.stability === undefined
							? null
							: String(schedule.stability),
					difficulty:
						schedule.difficulty === undefined
							? null
							: String(schedule.difficulty),
					updatedAt: schedule.lastCompletedAt,
				};

				await executor
					.insert(reviewStates)
					.values(row)
					.onConflictDoUpdate({ target: reviewStates.questionId, set: row });
			}
		},

		async findSchedules(
			questionIds: readonly QuestionId[],
		): Promise<readonly RepetitionSchedule[]> {
			if (questionIds.length === 0) {
				return [];
			}

			const rows = await executor
				.select()
				.from(reviewStates)
				.where(
					and(mine, inArray(reviewStates.questionId, questionIds.map(String))),
				);

			return rows.map(toSchedule);
		},

		async listDue(at: Date): Promise<readonly RepetitionSchedule[]> {
			const rows = await executor
				.select()
				.from(reviewStates)
				.where(and(mine, lte(reviewStates.dueAt, at)))
				.orderBy(asc(reviewStates.dueAt));

			return rows.map(toSchedule);
		},

		async listLeeches(
			threshold: number,
		): Promise<readonly RepetitionSchedule[]> {
			const rows = await executor
				.select()
				.from(reviewStates)
				.where(and(mine, sql`${reviewStates.lapses} >= ${threshold}`))
				.orderBy(sql`${reviewStates.lapses} desc`);

			return rows.map(toSchedule);
		},

		async saveSettings(
			scope: SettingsScope,
			settings: QuizSettings,
		): Promise<void> {
			const row = {
				id: crypto.randomUUID(),
				ownerId: owner,
				scopeType: scope.kind,
				scopeId: scopeId(scope),
				scheduler: settings.repetition.scheduler,
				intervalsDays: [...settings.repetition.intervalsDays],
				maxIntervalDays: settings.repetition.maxIntervalDays,
				maxRepetitions: settings.repetition.maxRepetitions,
				desiredRetention: String(settings.repetition.desiredRetention),
				shuffleOptions: settings.shuffleOptions,
				shuffleQuestions: settings.shuffleQuestions,
				examMode: settings.examMode,
				updatedAt: new Date(),
			};

			await executor
				.insert(studySettings)
				.values(row)
				.onConflictDoUpdate({
					target: [
						studySettings.ownerId,
						studySettings.scopeType,
						studySettings.scopeId,
					],
					set: {
						scheduler: row.scheduler,
						intervalsDays: row.intervalsDays,
						maxIntervalDays: row.maxIntervalDays,
						maxRepetitions: row.maxRepetitions,
						desiredRetention: row.desiredRetention,
						shuffleOptions: row.shuffleOptions,
						shuffleQuestions: row.shuffleQuestions,
						examMode: row.examMode,
						updatedAt: row.updatedAt,
					},
				});
		},

		async findSettings(
			scope: SettingsScope,
		): Promise<QuizSettings | undefined> {
			const [row] = await executor
				.select()
				.from(studySettings)
				.where(scopeMatch(scope, owner))
				.limit(1);

			return row === undefined ? undefined : toSettings(row);
		},

		async clearSettings(scope: SettingsScope): Promise<void> {
			await executor.delete(studySettings).where(scopeMatch(scope, owner));
		},
	};
}
