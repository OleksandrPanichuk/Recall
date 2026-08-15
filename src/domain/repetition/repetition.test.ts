import { describe, expect, test } from "bun:test";
import { toQuizSetId } from "../quiz-set/quiz-set";
import {
	createRepetitionSettings,
	defaultRepetitionSettings,
	dueRepetitionOf,
	intervalDaysFor,
	isDue,
	isRetired,
	overdueDaysOf,
	type RepetitionSchedule,
	RepetitionSettingsValidationError,
	scheduleAfter,
} from "./repetition";

const setId = toQuizSetId("set-1");
const user = 42;
const day = 24 * 60 * 60 * 1000;
const at = (iso: string): Date => new Date(iso);
const start = at("2026-08-15T09:00:00.000Z");

const settings = defaultRepetitionSettings();

const complete = (
	previous: RepetitionSchedule | undefined,
	completedAt: Date,
	overrides: Partial<Parameters<typeof createRepetitionSettings>[0]> = {},
): RepetitionSchedule =>
	scheduleAfter(
		previous,
		setId,
		user,
		createRepetitionSettings({ ...settings, ...overrides }),
		completedAt,
	);

const daysBetween = (from: Date, to: Date): number =>
	Math.round((to.getTime() - from.getTime()) / day);

describe("intervalDaysFor", () => {
	test.each([
		[1, 1],
		[2, 3],
		[3, 7],
		[4, 14],
		[5, 30],
	])("repetition %i waits %i days", (count, expected) => {
		expect(intervalDaysFor(count, settings)).toBe(expected);
	});

	test("keeps the last interval once the list runs out", () => {
		expect(intervalDaysFor(9, settings)).toBe(30);
	});

	test("never exceeds the ceiling", () => {
		const capped = createRepetitionSettings({
			...settings,
			maxIntervalDays: 7,
		});

		expect(intervalDaysFor(5, capped)).toBe(7);
		expect(intervalDaysFor(50, capped)).toBe(7);
	});
});

describe("scheduleAfter", () => {
	test("the first pass comes back the next day", () => {
		const schedule = complete(undefined, start);

		expect(schedule.repetitionCount).toBe(1);
		expect(daysBetween(start, schedule.dueAt as Date)).toBe(1);
	});

	test("each repetition waits longer than the last", () => {
		let schedule = complete(undefined, start);
		const waits: number[] = [];

		for (let round = 0; round < 4; round += 1) {
			const completedAt = schedule.dueAt as Date;
			const next = complete(schedule, completedAt);

			waits.push(daysBetween(completedAt, next.dueAt as Date));
			schedule = next;
		}

		expect(waits).toEqual([3, 7, 14, 30]);
	});

	test("counts from when it was actually taken, not when it was due", () => {
		const first = complete(undefined, start);
		const muchLater = at("2026-09-20T09:00:00.000Z");

		const second = complete(first, muchLater);

		expect(daysBetween(muchLater, second.dueAt as Date)).toBe(3);
	});

	test("retires once the repetition limit is reached", () => {
		let schedule = complete(undefined, start, { maxRepetitions: 3 });

		expect(isRetired(schedule)).toBe(false);

		schedule = complete(schedule, start, { maxRepetitions: 3 });

		expect(isRetired(schedule)).toBe(false);

		schedule = complete(schedule, start, { maxRepetitions: 3 });

		expect(isRetired(schedule)).toBe(true);
		expect(schedule.repetitionCount).toBe(3);
	});

	test("rejects an invalid completion date", () => {
		expect(() => complete(undefined, new Date("nope"))).toThrow(
			RepetitionSettingsValidationError,
		);
	});
});

describe("isDue and overdueDaysOf", () => {
	const schedule = complete(undefined, start);

	test("is not due before its date", () => {
		expect(isDue(schedule, at("2026-08-16T08:59:00.000Z"))).toBe(false);
	});

	test("is due on its date", () => {
		expect(isDue(schedule, at("2026-08-16T09:00:00.000Z"))).toBe(true);
	});

	test("counts whole days overdue", () => {
		expect(overdueDaysOf(schedule, at("2026-08-21T09:00:00.000Z"))).toBe(5);
	});

	test("a retired schedule is never due", () => {
		const retired = complete(undefined, start, { maxRepetitions: 1 });

		expect(isDue(retired, at("2030-01-01T00:00:00.000Z"))).toBe(false);
		expect(overdueDaysOf(retired, at("2030-01-01T00:00:00.000Z"))).toBe(0);
	});
});

describe("dueRepetitionOf", () => {
	test("describes an overdue set", () => {
		const schedule = complete(undefined, start);
		const due = dueRepetitionOf(schedule, at("2026-08-21T09:00:00.000Z"));

		expect(due?.overdueDays).toBe(5);
		expect(due?.repetitionCount).toBe(1);
	});

	test("is nothing when the set is not due yet", () => {
		expect(dueRepetitionOf(complete(undefined, start), start)).toBeUndefined();
	});
});

describe("createRepetitionSettings", () => {
	test.each([
		["no intervals", { intervalsDays: [] }],
		["a zero interval", { intervalsDays: [1, 0] }],
		["a fractional interval", { intervalsDays: [1.5] }],
		["a zero ceiling", { maxIntervalDays: 0 }],
		["a zero repetition limit", { maxRepetitions: 0 }],
		["an absurd ceiling", { maxIntervalDays: 100_000 }],
	])("rejects %s", (_name, overrides) => {
		expect(() =>
			createRepetitionSettings({ ...settings, ...overrides }),
		).toThrow(RepetitionSettingsValidationError);
	});

	test("accepts the defaults", () => {
		expect(createRepetitionSettings(settings).intervalsDays).toEqual([
			1, 3, 7, 14, 30,
		]);
	});
});
