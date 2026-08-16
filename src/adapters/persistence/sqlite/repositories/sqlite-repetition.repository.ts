import { and, asc, desc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { QuestionId } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type { RepetitionSchedule } from "@/domain/repetition/repetition";
import type { QuizSettings } from "@/domain/settings/quiz-settings";
import type { QuizDatabase } from "../database";
import {
	repetitionDefaults,
	repetitionSchedules,
	repetitionSettings,
} from "../schema";
import {
	toQuizSettings,
	toRepetitionSchedule,
	toRepetitionScheduleRow,
} from "./repetition.mapper";

const DEFAULTS_ROW_ID = 1;

export function createSqliteRepetitionRepository(
	database: QuizDatabase,
	transaction: Transaction,
	now: () => Date,
): RepetitionRepository {
	const settingsRow = (settings: QuizSettings, at: Date) => ({
		intervalsDays: JSON.stringify(settings.repetition.intervalsDays),
		maxIntervalDays: settings.repetition.maxIntervalDays,
		maxRepetitions: settings.repetition.maxRepetitions,
		shuffleOptions: settings.shuffleOptions ? 1 : 0,
		updatedAt: at.toISOString(),
	});

	return {
		saveSchedules(schedules: readonly RepetitionSchedule[]): void {
			if (schedules.length === 0) {
				return;
			}

			const at = now();

			transaction.run(() => {
				for (const schedule of schedules) {
					const row = toRepetitionScheduleRow(schedule, at);

					database
						.insert(repetitionSchedules)
						.values(row)
						.onConflictDoUpdate({
							target: [
								repetitionSchedules.questionId,
								repetitionSchedules.telegramUserId,
							],
							set: {
								repetitionCount: row.repetitionCount,
								lapses: row.lapses,
								lastCompletedAt: row.lastCompletedAt,
								dueAt: row.dueAt,
								updatedAt: row.updatedAt,
							},
						})
						.run();
				}
			});
		},

		findSchedules(
			questionIds: readonly QuestionId[],
			telegramUserId: number,
		): readonly RepetitionSchedule[] {
			if (questionIds.length === 0) {
				return [];
			}

			return database
				.select()
				.from(repetitionSchedules)
				.where(
					and(
						eq(repetitionSchedules.telegramUserId, telegramUserId),
						inArray(repetitionSchedules.questionId, [...questionIds]),
					),
				)
				.all()
				.map(toRepetitionSchedule);
		},

		listDue(telegramUserId: number, at: Date): readonly RepetitionSchedule[] {
			return database
				.select()
				.from(repetitionSchedules)
				.where(
					and(
						eq(repetitionSchedules.telegramUserId, telegramUserId),
						isNotNull(repetitionSchedules.dueAt),
						lte(repetitionSchedules.dueAt, at.toISOString()),
					),
				)
				.orderBy(asc(repetitionSchedules.dueAt))
				.all()
				.map(toRepetitionSchedule);
		},

		listLeeches(
			telegramUserId: number,
			threshold: number,
		): readonly RepetitionSchedule[] {
			return database
				.select()
				.from(repetitionSchedules)
				.where(
					and(
						eq(repetitionSchedules.telegramUserId, telegramUserId),
						gte(repetitionSchedules.lapses, threshold),
					),
				)
				.orderBy(desc(repetitionSchedules.lapses))
				.all()
				.map(toRepetitionSchedule);
		},

		saveSettings(quizSetId: QuizSetId, settings: QuizSettings): void {
			const row = { quizSetId, ...settingsRow(settings, now()) };

			transaction.run(() => {
				database
					.insert(repetitionSettings)
					.values(row)
					.onConflictDoUpdate({
						target: repetitionSettings.quizSetId,
						set: row,
					})
					.run();
			});
		},

		clearSettings(quizSetId: QuizSetId): void {
			transaction.run(() => {
				database
					.delete(repetitionSettings)
					.where(eq(repetitionSettings.quizSetId, quizSetId))
					.run();
			});
		},

		findSettings(quizSetId: QuizSetId): QuizSettings | undefined {
			const row = database
				.select()
				.from(repetitionSettings)
				.where(eq(repetitionSettings.quizSetId, quizSetId))
				.get();

			return row ? toQuizSettings(row, quizSetId) : undefined;
		},

		saveDefaults(settings: QuizSettings): void {
			const row = { id: DEFAULTS_ROW_ID, ...settingsRow(settings, now()) };

			transaction.run(() => {
				database
					.insert(repetitionDefaults)
					.values(row)
					.onConflictDoUpdate({ target: repetitionDefaults.id, set: row })
					.run();
			});
		},

		findDefaults(): QuizSettings | undefined {
			const row = database
				.select()
				.from(repetitionDefaults)
				.where(eq(repetitionDefaults.id, DEFAULTS_ROW_ID))
				.get();

			return row ? toQuizSettings(row, "defaults") : undefined;
		},
	};
}
