import { describe, expect, test } from "bun:test";
import { toQuestionId } from "@/modules/quizzes";
import { RecallGrade } from "./recall-grade";
import { ScheduleEntity } from "./schedule.entity";

const questionId = toQuestionId("question-1");
const user = 42;
const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (at: Date): Date =>
	new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));

const fsrsSettings = (overrides: Record<string, unknown> = {}) =>
	ScheduleEntity.createSettings({
		...ScheduleEntity.defaultSettings(),
		scheduler: "fsrs",
		...overrides,
	});

const review = (
	previous: ScheduleEntity | undefined,
	completedAt: Date,
	answeredCorrectly: boolean,
	overrides: Record<string, unknown> = {},
): ScheduleEntity =>
	ScheduleEntity.scheduleAfter(
		previous,
		questionId,
		user,
		fsrsSettings(overrides),
		completedAt,
		startOfDay(completedAt),
		answeredCorrectly ? RecallGrade.Good : RecallGrade.Again,
	);

const graded = (
	previous: ScheduleEntity | undefined,
	completedAt: Date,
	grade: RecallGrade,
): ScheduleEntity =>
	ScheduleEntity.scheduleAfter(
		previous,
		questionId,
		user,
		fsrsSettings(),
		completedAt,
		startOfDay(completedAt),
		grade,
	);

const intervalDaysOf = (schedule: ScheduleEntity, at: Date): number =>
	Math.round(
		((schedule.dueAt?.getTime() ?? 0) - startOfDay(at).getTime()) / DAY_MS,
	);

const first = new Date("2026-08-15T09:00:00.000Z");

describe("the fsrs scheduler", () => {
	test("a first correct answer produces memory state the ladder never had", () => {
		const schedule = review(undefined, first, true);

		expect(schedule.stability).toBeGreaterThan(0);
		expect(schedule.difficulty).toBeGreaterThan(0);
		expect(schedule.repetitionCount).toBe(1);
		expect(schedule.lapses).toBe(0);
	});

	test("intervals are whole days, never same-day", () => {
		let schedule = review(undefined, first, true);
		let at = first;

		for (let round = 0; round < 5; round += 1) {
			const days = intervalDaysOf(schedule, at);

			expect(days).toBeGreaterThanOrEqual(1);
			expect(Number.isInteger(days)).toBe(true);

			at = new Date((schedule.dueAt as Date).getTime() + 9 * 60 * 60 * 1000);
			schedule = review(schedule, at, true);
		}
	});

	test("remembering repeatedly stretches the interval", () => {
		const one = review(undefined, first, true);
		const twoAt = new Date((one.dueAt as Date).getTime() + 3600_000);
		const two = review(one, twoAt, true);

		expect(two.stability as number).toBeGreaterThan(one.stability as number);
		expect(intervalDaysOf(two, twoAt)).toBeGreaterThan(
			intervalDaysOf(one, first),
		);
	});

	test("forgetting counts a lapse, collapses stability and shortens the interval", () => {
		const one = review(undefined, first, true);
		const twoAt = new Date((one.dueAt as Date).getTime() + 3600_000);
		const two = review(one, twoAt, true);
		const lapseAt = new Date((two.dueAt as Date).getTime() + 3600_000);
		const lapsed = review(two, lapseAt, false);

		expect(lapsed.lapses).toBe(1);
		expect(lapsed.stability as number).toBeLessThan(two.stability as number);
		expect(lapsed.difficulty as number).toBeGreaterThan(
			two.difficulty as number,
		);
		expect(intervalDaysOf(lapsed, lapseAt)).toBeLessThan(
			intervalDaysOf(two, twoAt),
		);
	});

	test("maxIntervalDays is a ceiling the schedule cannot cross", () => {
		let schedule = review(undefined, first, true, { maxIntervalDays: 5 });
		let at = first;

		for (let round = 0; round < 8; round += 1) {
			expect(intervalDaysOf(schedule, at)).toBeLessThanOrEqual(5);

			at = new Date((schedule.dueAt as Date).getTime() + 3600_000);
			schedule = review(schedule, at, true, { maxIntervalDays: 5 });
		}
	});

	test("asking for higher retention schedules sooner", () => {
		const relaxed = review(undefined, first, true, { desiredRetention: 0.8 });
		const strict = review(undefined, first, true, { desiredRetention: 0.97 });

		expect(intervalDaysOf(strict, first)).toBeLessThan(
			intervalDaysOf(relaxed, first),
		);
	});

	test("nothing retires: fsrs keeps scheduling past maxRepetitions", () => {
		let schedule = review(undefined, first, true, { maxRepetitions: 2 });
		let at = first;

		for (let round = 0; round < 4; round += 1) {
			at = new Date((schedule.dueAt as Date).getTime() + 3600_000);
			schedule = review(schedule, at, true, { maxRepetitions: 2 });
		}

		expect(ScheduleEntity.isRetired(schedule)).toBe(false);
		expect(schedule.repetitionCount).toBeGreaterThan(2);
	});

	test("the same history schedules the same day, twice over", () => {
		const once = review(undefined, first, true);
		const twice = review(undefined, first, true);

		expect(twice.dueAt?.toISOString()).toBe(once.dueAt?.toISOString());
		expect(twice.stability).toBe(once.stability as number);
	});

	test("a schedule the ladder wrote is picked up without memory state", () => {
		const fromLadder: ScheduleEntity = Object.freeze({
			questionId,
			telegramUserId: user,
			repetitionCount: 3,
			lapses: 1,
			lastCompletedAt: first,
			dueAt: new Date(first.getTime() + 7 * DAY_MS),
		});
		const at = new Date(first.getTime() + 7 * DAY_MS);
		const schedule = review(fromLadder, at, true);

		expect(schedule.stability).toBeGreaterThan(0);
		expect(schedule.dueAt).toBeDefined();
	});
});

describe("choosing between the two schedulers", () => {
	test("the ladder is what an unconfigured owner gets", () => {
		expect(ScheduleEntity.defaultSettings().scheduler).toBe("ladder");
	});

	test("the ladder writes no memory state", () => {
		const schedule = ScheduleEntity.scheduleAfter(
			undefined,
			questionId,
			user,
			ScheduleEntity.defaultSettings(),
			first,
			startOfDay(first),
			RecallGrade.Good,
		);

		expect(schedule.stability).toBeUndefined();
		expect(schedule.difficulty).toBeUndefined();
	});

	test("a scheduler nobody implements is refused", () => {
		expect(() =>
			ScheduleEntity.createSettings({
				...ScheduleEntity.defaultSettings(),
				scheduler: "sm2" as "ladder",
			}),
		).toThrow();
	});

	test("retention outside the sane band is refused", () => {
		expect(() => fsrsSettings({ desiredRetention: 0.5 })).toThrow();
		expect(() => fsrsSettings({ desiredRetention: 1 })).toThrow();
	});
});

describe("how the grade a learner gives changes the interval", () => {
	const first = new Date("2026-08-01T09:00:00.000Z");
	const second = new Date("2026-08-05T09:00:00.000Z");

	const intervalAfter = (grade: RecallGrade): number => {
		const start = graded(undefined, first, RecallGrade.Good);

		return intervalDaysOf(graded(start, second, grade), second);
	};

	test("easy waits longer than good, and good longer than hard", () => {
		const hard = intervalAfter(RecallGrade.Hard);
		const good = intervalAfter(RecallGrade.Good);
		const easy = intervalAfter(RecallGrade.Easy);

		expect(hard).toBeLessThan(good);
		expect(good).toBeLessThan(easy);
	});

	test("every grade but Again still schedules ahead of the review", () => {
		for (const grade of [
			RecallGrade.Hard,
			RecallGrade.Good,
			RecallGrade.Easy,
		]) {
			expect(intervalAfter(grade)).toBeGreaterThan(0);
		}
	});

	test("Again comes back soonest of the four", () => {
		expect(intervalAfter(RecallGrade.Again)).toBeLessThanOrEqual(
			intervalAfter(RecallGrade.Hard),
		);
	});

	test("and Again is the only grade that counts a lapse", () => {
		const start = graded(undefined, first, RecallGrade.Good);

		expect(graded(start, second, RecallGrade.Hard).lapses).toBe(0);
		expect(graded(start, second, RecallGrade.Again).lapses).toBe(1);
	});

	test("hard still records memory state, so it is a review and not a reset", () => {
		const start = graded(undefined, first, RecallGrade.Good);
		const after = graded(start, second, RecallGrade.Hard);

		expect(after.stability).toBeGreaterThan(0);
		expect(after.difficulty).toBeGreaterThan(0);
	});
});

describe("the ladder ignores the grade on purpose", () => {
	const first = new Date("2026-08-01T09:00:00.000Z");

	const ladder = (grade: RecallGrade): ScheduleEntity =>
		ScheduleEntity.scheduleAfter(
			undefined,
			questionId,
			user,
			ScheduleEntity.defaultSettings(),
			first,
			startOfDay(first),
			grade,
		);

	test("hard, good and easy all land on the same rung", () => {
		const hard = ladder(RecallGrade.Hard).dueAt?.getTime();

		expect(ladder(RecallGrade.Good).dueAt?.getTime()).toBe(hard);
		expect(ladder(RecallGrade.Easy).dueAt?.getTime()).toBe(hard);
	});

	test("but Again still restarts it, because that is right or wrong", () => {
		expect(ladder(RecallGrade.Again).repetitionCount).toBe(1);
		expect(ladder(RecallGrade.Again).lapses).toBe(1);
		expect(ladder(RecallGrade.Good).lapses).toBe(0);
	});
});
