import { describe, expect, test } from "bun:test";
import { toQuestionId } from "../quiz-set/question";
import {
	createRepetitionSettings,
	defaultRepetitionSettings,
	isRetired,
	type RepetitionSchedule,
	scheduleAfter,
} from "./repetition";

const questionId = toQuestionId("question-1");
const user = 42;
const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (at: Date): Date =>
	new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));

const fsrsSettings = (overrides: Record<string, unknown> = {}) =>
	createRepetitionSettings({
		...defaultRepetitionSettings(),
		scheduler: "fsrs",
		...overrides,
	});

const review = (
	previous: RepetitionSchedule | undefined,
	completedAt: Date,
	answeredCorrectly: boolean,
	overrides: Record<string, unknown> = {},
): RepetitionSchedule =>
	scheduleAfter(
		previous,
		questionId,
		user,
		fsrsSettings(overrides),
		completedAt,
		startOfDay(completedAt),
		answeredCorrectly,
	);

const intervalDaysOf = (schedule: RepetitionSchedule, at: Date): number =>
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

		expect(isRetired(schedule)).toBe(false);
		expect(schedule.repetitionCount).toBeGreaterThan(2);
	});

	test("the same history schedules the same day, twice over", () => {
		const once = review(undefined, first, true);
		const twice = review(undefined, first, true);

		expect(twice.dueAt?.toISOString()).toBe(once.dueAt?.toISOString());
		expect(twice.stability).toBe(once.stability as number);
	});

	test("a schedule the ladder wrote is picked up without memory state", () => {
		const fromLadder: RepetitionSchedule = Object.freeze({
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
		expect(defaultRepetitionSettings().scheduler).toBe("ladder");
	});

	test("the ladder writes no memory state", () => {
		const schedule = scheduleAfter(
			undefined,
			questionId,
			user,
			defaultRepetitionSettings(),
			first,
			startOfDay(first),
			true,
		);

		expect(schedule.stability).toBeUndefined();
		expect(schedule.difficulty).toBeUndefined();
	});

	test("a scheduler nobody implements is refused", () => {
		expect(() =>
			createRepetitionSettings({
				...defaultRepetitionSettings(),
				scheduler: "sm2" as "ladder",
			}),
		).toThrow();
	});

	test("retention outside the sane band is refused", () => {
		expect(() => fsrsSettings({ desiredRetention: 0.5 })).toThrow();
		expect(() => fsrsSettings({ desiredRetention: 1 })).toThrow();
	});
});
