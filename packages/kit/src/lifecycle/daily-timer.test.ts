import { describe, expect, test } from "bun:test";
import { millisecondsUntil } from "./daily-timer";

const hours = (value: number): number => value * 60 * 60 * 1000;
const at = (iso: string): Date => new Date(iso);

describe("millisecondsUntil", () => {
	test("waits the rest of the day when the hour has passed", () => {
		expect(
			millisecondsUntil(at("2026-08-15T07:00:00.000Z"), 9, "Europe/Kyiv"),
		).toBe(hours(23));
	});

	test("waits until later today when the hour is ahead", () => {
		expect(
			millisecondsUntil(at("2026-08-15T05:00:00.000Z"), 9, "Europe/Kyiv"),
		).toBe(hours(1));
	});

	test("never returns zero, so a fire cannot loop instantly", () => {
		expect(
			millisecondsUntil(at("2026-08-15T06:00:00.000Z"), 9, "Europe/Kyiv"),
		).toBeGreaterThan(0);
	});

	test.each([
		["2026-03-28T22:00:00.000Z", "spring forward"],
		["2026-10-24T22:00:00.000Z", "autumn back"],
	])("lands on the right hour across %s", (iso) => {
		const before = at(iso);
		const fired = new Date(
			before.getTime() + millisecondsUntil(before, 9, "Europe/Kyiv"),
		);

		expect(
			Number(
				new Intl.DateTimeFormat("en-CA", {
					timeZone: "Europe/Kyiv",
					hour12: false,
					hour: "2-digit",
				}).format(fired),
			),
		).toBe(9);
	});

	test("follows the zone, not the server clock", () => {
		const kyiv = millisecondsUntil(
			at("2026-08-15T05:00:00.000Z"),
			9,
			"Europe/Kyiv",
		);
		const london = millisecondsUntil(
			at("2026-08-15T05:00:00.000Z"),
			9,
			"Europe/London",
		);

		expect(kyiv).not.toBe(london);
	});

	test("still lands on the right hour across a spring-forward night", () => {
		const before = at("2026-03-28T22:00:00.000Z");
		const wait = millisecondsUntil(before, 9, "Europe/Kyiv");
		const fired = new Date(before.getTime() + wait);
		const hour = new Intl.DateTimeFormat("en-CA", {
			timeZone: "Europe/Kyiv",
			hour12: false,
			hour: "2-digit",
		}).format(fired);

		expect(Number(hour)).toBe(9);
	});
});

describe("the night a clock jumps forward", () => {
	const localHour = (at: Date, timezone: string): number =>
		Number(
			new Intl.DateTimeFormat("en-CA", {
				timeZone: timezone,
				hour12: false,
				hour: "2-digit",
			}).format(at),
		);

	test.each([
		["Europe/Kyiv", "2026-03-29"],
		["Europe/London", "2026-03-29"],
		["America/New_York", "2026-03-08"],
		["Australia/Sydney", "2026-10-04"],
	])("never skips a day in %s", (timezone, switchDay) => {
		const midnight = new Date(`${switchDay}T00:00:00.000Z`);

		for (let minutes = -120; minutes < 0; minutes += 5) {
			const now = new Date(midnight.getTime() + minutes * 60_000);
			const wait = millisecondsUntil(now, 9, timezone);

			expect(wait).toBeGreaterThan(0);
			expect(wait).toBeLessThanOrEqual(25 * 60 * 60 * 1000);
			expect(localHour(new Date(now.getTime() + wait), timezone)).toBe(9);
		}
	});

	test("waits hours, not a day and a half, at 23:59 before the switch", () => {
		const wait = millisecondsUntil(
			new Date("2026-03-28T21:59:00.000Z"),
			9,
			"Europe/Kyiv",
		);

		expect(wait / (60 * 60 * 1000)).toBeLessThan(12);
	});
});
