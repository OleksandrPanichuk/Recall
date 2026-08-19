import { toQuestionId } from "@/domain/quiz-set/question";
import type { RepetitionSchedule } from "@/domain/repetition/repetition";
import {
	createQuizSettings,
	type QuizSettings,
} from "@/domain/settings/quiz-settings";
import type {
	repetitionDefaults,
	repetitionSchedules,
	repetitionSettings,
} from "../schema";
import { CorruptedRepetitionRowError } from "./repetition.mapper.errors";
import { createRowValueParsers } from "./utils/row-values";

export type RepetitionScheduleRow = typeof repetitionSchedules.$inferSelect;
export type RepetitionScheduleInsert = typeof repetitionSchedules.$inferInsert;
export type RepetitionSettingsRow = typeof repetitionSettings.$inferSelect;
export type RepetitionDefaultsRow = typeof repetitionDefaults.$inferSelect;

const { requiredDate, optionalDate } = createRowValueParsers(
	(id, issues) => new CorruptedRepetitionRowError(id, issues),
);

const parseIntervals = (raw: string, id: string): number[] => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new CorruptedRepetitionRowError(id, [
			"intervals_days must be a JSON array",
		]);
	}

	if (
		!Array.isArray(parsed) ||
		parsed.some((value) => !Number.isSafeInteger(value))
	) {
		throw new CorruptedRepetitionRowError(id, [
			"intervals_days must be a list of whole numbers",
		]);
	}

	return parsed as number[];
};

export function toRepetitionSchedule(
	row: RepetitionScheduleRow,
): RepetitionSchedule {
	const id = `${row.questionId}/${row.telegramUserId}`;

	return Object.freeze({
		questionId: toQuestionId(row.questionId),
		telegramUserId: row.telegramUserId,
		repetitionCount: row.repetitionCount,
		lapses: row.lapses,
		lastCompletedAt: requiredDate(row.lastCompletedAt, "last_completed_at", id),
		dueAt: optionalDate(row.dueAt, "due_at", id),
	});
}

export function toRepetitionScheduleRow(
	schedule: RepetitionSchedule,
	at: Date,
): RepetitionScheduleInsert {
	return {
		questionId: schedule.questionId,
		telegramUserId: schedule.telegramUserId,
		repetitionCount: schedule.repetitionCount,
		lapses: schedule.lapses,
		lastCompletedAt: schedule.lastCompletedAt.toISOString(),
		dueAt: schedule.dueAt?.toISOString() ?? null,
		createdAt: at.toISOString(),
		updatedAt: at.toISOString(),
	};
}

export function toQuizSettings(
	row: RepetitionSettingsRow | RepetitionDefaultsRow,
	id: string,
): QuizSettings {
	return createQuizSettings({
		repetition: {
			intervalsDays: parseIntervals(row.intervalsDays, id),
			maxIntervalDays: row.maxIntervalDays,
			maxRepetitions: row.maxRepetitions,
		},
		shuffleOptions: row.shuffleOptions === 1,
		shuffleQuestions: row.shuffleQuestions === 1,
		examMode: row.examMode === 1,
	});
}
