import { and, asc, eq, isNotNull, lte } from "drizzle-orm";
import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type {
	RepetitionSchedule,
	RepetitionSettings,
} from "@/domain/repetition/repetition";
import type { QuizDatabase } from "../database";
import {
	repetitionDefaults,
	repetitionSchedules,
	repetitionSettings,
} from "../schema";
import {
	toRepetitionSchedule,
	toRepetitionScheduleRow,
	toRepetitionSettings,
} from "./repetition.mapper";

const DEFAULTS_ROW_ID = 1;

export function createSqliteRepetitionRepository(
	database: QuizDatabase,
	transaction: Transaction,
	now: () => Date,
): RepetitionRepository {
	const settingsRow = (settings: RepetitionSettings, at: Date) => ({
		intervalsDays: JSON.stringify(settings.intervalsDays),
		maxIntervalDays: settings.maxIntervalDays,
		maxRepetitions: settings.maxRepetitions,
		updatedAt: at.toISOString(),
	});

	return {
		saveSchedule(schedule: RepetitionSchedule): void {
			const row = toRepetitionScheduleRow(schedule, now());

			transaction.run(() => {
				database
					.insert(repetitionSchedules)
					.values(row)
					.onConflictDoUpdate({
						target: [
							repetitionSchedules.quizSetId,
							repetitionSchedules.telegramUserId,
						],
						set: {
							repetitionCount: row.repetitionCount,
							lastCompletedAt: row.lastCompletedAt,
							dueAt: row.dueAt,
							updatedAt: row.updatedAt,
						},
					})
					.run();
			});
		},

		findSchedule(
			quizSetId: QuizSetId,
			telegramUserId: number,
		): RepetitionSchedule | undefined {
			const row = database
				.select()
				.from(repetitionSchedules)
				.where(
					and(
						eq(repetitionSchedules.quizSetId, quizSetId),
						eq(repetitionSchedules.telegramUserId, telegramUserId),
					),
				)
				.get();

			return row ? toRepetitionSchedule(row) : undefined;
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

		saveSettings(quizSetId: QuizSetId, settings: RepetitionSettings): void {
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

		findSettings(quizSetId: QuizSetId): RepetitionSettings | undefined {
			const row = database
				.select()
				.from(repetitionSettings)
				.where(eq(repetitionSettings.quizSetId, quizSetId))
				.get();

			return row ? toRepetitionSettings(row, quizSetId) : undefined;
		},

		saveDefaults(settings: RepetitionSettings): void {
			const row = { id: DEFAULTS_ROW_ID, ...settingsRow(settings, now()) };

			transaction.run(() => {
				database
					.insert(repetitionDefaults)
					.values(row)
					.onConflictDoUpdate({ target: repetitionDefaults.id, set: row })
					.run();
			});
		},

		findDefaults(): RepetitionSettings | undefined {
			const row = database
				.select()
				.from(repetitionDefaults)
				.where(eq(repetitionDefaults.id, DEFAULTS_ROW_ID))
				.get();

			return row ? toRepetitionSettings(row, "defaults") : undefined;
		},
	};
}
