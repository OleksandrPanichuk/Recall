import {
	type Card,
	createEmptyCard,
	fsrs,
	type Grade,
	Rating,
	State,
} from "ts-fsrs";
import { type QuestionId } from "@/modules/quizzes";
import { copiedDate } from "@/shared/utils/date";
import { RecallGrade } from "./recall-grade";
import { ScheduleEntity } from "./schedule.entity";
import { type RepetitionSettings } from "./schedule.entity.types";
import { DAY_MS } from "./scheduling.constants";

const RATINGS: Readonly<Record<RecallGrade, Grade>> = {
	[RecallGrade.Again]: Rating.Again,
	[RecallGrade.Hard]: Rating.Hard,
	[RecallGrade.Good]: Rating.Good,
	[RecallGrade.Easy]: Rating.Easy,
};

const schedulerFor = (settings: RepetitionSettings) =>
	fsrs({
		request_retention: settings.desiredRetention,
		maximum_interval: settings.maxIntervalDays,
		enable_fuzz: false,
		enable_short_term: false,
	});

const cardOf = (
	previous: ScheduleEntity | undefined,
	completedAt: Date,
): Card => {
	if (previous?.stability === undefined || previous.difficulty === undefined) {
		return createEmptyCard(completedAt);
	}

	return {
		due: previous.dueAt ?? completedAt,
		stability: previous.stability,
		difficulty: previous.difficulty,
		elapsed_days: 0,
		scheduled_days: 0,
		reps: previous.repetitionCount,
		lapses: previous.lapses,
		learning_steps: 0,
		state: State.Review,
		last_review: previous.lastCompletedAt,
	};
};

export function fsrsScheduleAfter(
	previous: ScheduleEntity | undefined,
	questionId: QuestionId,
	telegramUserId: number | undefined,
	settings: RepetitionSettings,
	completedAt: Date,
	completedDayStart: Date,
	grade: RecallGrade,
): ScheduleEntity {
	const { card } = schedulerFor(settings).next(
		cardOf(previous, completedAt),
		completedAt,
		RATINGS[grade],
	);

	const intervalDays = Math.max(
		1,
		Math.min(card.scheduled_days, settings.maxIntervalDays),
	);

	return Object.freeze({
		questionId,
		telegramUserId,
		repetitionCount: card.reps,
		lapses: card.lapses,
		lastCompletedAt: copiedDate(completedAt),
		dueAt: new Date(completedDayStart.getTime() + intervalDays * DAY_MS),
		stability: card.stability,
		difficulty: card.difficulty,
	});
}
