import { copiedDate, isValidDate } from "@/shared/utils/date";
import type { QuestionId } from "../quiz-set/question";
import {
	DEFAULT_INTERVALS_DAYS,
	DEFAULT_MAX_INTERVAL_DAYS,
	DEFAULT_MAX_REPETITIONS,
	MAX_INTERVAL_LIMIT_DAYS,
	MAX_INTERVALS,
	MAX_REPETITIONS_LIMIT,
} from "./repetition.constants";
import { RepetitionSettingsValidationError } from "./repetition.errors";
import type {
	Leech,
	RepetitionSchedule,
	RepetitionSettings,
} from "./repetition.types";

export {
	DEFAULT_INTERVALS_DAYS,
	DEFAULT_LEECH_THRESHOLD,
	DEFAULT_MAX_INTERVAL_DAYS,
	DEFAULT_MAX_REPETITIONS,
	MAX_INTERVAL_LIMIT_DAYS,
	MAX_INTERVALS,
	MAX_REPETITIONS_LIMIT,
} from "./repetition.constants";
export { RepetitionSettingsValidationError } from "./repetition.errors";
export type {
	DueSet,
	Leech,
	RepetitionSchedule,
	RepetitionSettings,
} from "./repetition.types";

const DAY_MS = 24 * 60 * 60 * 1000;

export const defaultRepetitionSettings = (): RepetitionSettings =>
	Object.freeze({
		intervalsDays: Object.freeze([...DEFAULT_INTERVALS_DAYS]),
		maxIntervalDays: DEFAULT_MAX_INTERVAL_DAYS,
		maxRepetitions: DEFAULT_MAX_REPETITIONS,
	});

const isPositiveInteger = (value: number): boolean =>
	Number.isSafeInteger(value) && value > 0;

export function createRepetitionSettings(
	draft: RepetitionSettings,
): RepetitionSettings {
	const issues: string[] = [];

	if (draft.intervalsDays.length === 0) {
		issues.push("intervalsDays must not be empty");
	}

	if (draft.intervalsDays.length > MAX_INTERVALS) {
		issues.push(`intervalsDays must not exceed ${MAX_INTERVALS} entries`);
	}

	if (!draft.intervalsDays.every(isPositiveInteger)) {
		issues.push("every interval must be a positive whole number of days");
	}

	if (
		!isPositiveInteger(draft.maxIntervalDays) ||
		draft.maxIntervalDays > MAX_INTERVAL_LIMIT_DAYS
	) {
		issues.push(
			`maxIntervalDays must be between 1 and ${MAX_INTERVAL_LIMIT_DAYS}`,
		);
	}

	if (
		!isPositiveInteger(draft.maxRepetitions) ||
		draft.maxRepetitions > MAX_REPETITIONS_LIMIT
	) {
		issues.push(
			`maxRepetitions must be between 1 and ${MAX_REPETITIONS_LIMIT}`,
		);
	}

	if (issues.length > 0) {
		throw new RepetitionSettingsValidationError(issues);
	}

	return Object.freeze({
		intervalsDays: Object.freeze([...draft.intervalsDays]),
		maxIntervalDays: draft.maxIntervalDays,
		maxRepetitions: draft.maxRepetitions,
	});
}

export function intervalDaysFor(
	repetitionCount: number,
	settings: RepetitionSettings,
): number {
	const index = Math.max(0, repetitionCount - 1);
	const planned =
		settings.intervalsDays[index] ?? settings.intervalsDays.at(-1) ?? 1;

	return Math.min(planned, settings.maxIntervalDays);
}

export function scheduleAfter(
	previous: RepetitionSchedule | undefined,
	questionId: QuestionId,
	telegramUserId: number,
	settings: RepetitionSettings,
	completedAt: Date,
	completedDayStart: Date,
	answeredCorrectly = true,
): RepetitionSchedule {
	if (!isValidDate(completedAt)) {
		throw new RepetitionSettingsValidationError([
			"completedAt must be a valid date",
		]);
	}

	// A wrong answer sends the question back to the start of the ladder: the
	// point of the interval is that you remembered, and you did not.
	const repetitionCount = answeredCorrectly
		? (previous?.repetitionCount ?? 0) + 1
		: 1;
	const lapses = (previous?.lapses ?? 0) + (answeredCorrectly ? 0 : 1);
	const retired =
		answeredCorrectly && repetitionCount > settings.maxRepetitions;

	return Object.freeze({
		questionId,
		telegramUserId,
		repetitionCount,
		lapses,
		lastCompletedAt: copiedDate(completedAt),
		dueAt: retired
			? undefined
			: new Date(
					completedDayStart.getTime() +
						intervalDaysFor(repetitionCount, settings) * DAY_MS,
				),
	});
}

export function isRetired(schedule: RepetitionSchedule): boolean {
	return schedule.dueAt === undefined;
}

export function isDue(schedule: RepetitionSchedule, at: Date): boolean {
	return (
		schedule.dueAt !== undefined && schedule.dueAt.getTime() <= at.getTime()
	);
}

export function overdueDaysOf(
	schedule: RepetitionSchedule,
	todayStart: Date,
): number {
	if (schedule.dueAt === undefined) {
		return 0;
	}

	return Math.max(
		0,
		Math.round((todayStart.getTime() - schedule.dueAt.getTime()) / DAY_MS),
	);
}

export function isLeech(
	schedule: RepetitionSchedule,
	threshold: number,
): boolean {
	return schedule.lapses >= threshold;
}

export function leechOf(
	schedule: RepetitionSchedule,
	threshold: number,
): Leech | undefined {
	return isLeech(schedule, threshold)
		? Object.freeze({
				questionId: schedule.questionId,
				lapses: schedule.lapses,
			})
		: undefined;
}
