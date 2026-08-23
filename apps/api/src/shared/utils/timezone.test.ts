import { describe, expect, test } from "bun:test";
import { startOfDayIn } from "./timezone";

const at = (iso: string): Date => new Date(iso);

describe("startOfDayIn", () => {
	test("finds local midnight, not UTC midnight", () => {
		expect(startOfDayIn(at("2026-08-15T10:00:00.000Z"), "Europe/Kyiv")).toEqual(
			at("2026-08-14T21:00:00.000Z"),
		);
	});

	test("an evening in Kyiv already belongs to the next local day", () => {
		expect(startOfDayIn(at("2026-08-15T21:30:00.000Z"), "Europe/Kyiv")).toEqual(
			at("2026-08-15T21:00:00.000Z"),
		);
	});

	test("is stable across the same local day", () => {
		expect(startOfDayIn(at("2026-08-15T05:00:00.000Z"), "Europe/Kyiv")).toEqual(
			startOfDayIn(at("2026-08-15T20:00:00.000Z"), "Europe/Kyiv"),
		);
	});

	test("handles a half-hour offset", () => {
		expect(
			startOfDayIn(at("2026-08-15T10:00:00.000Z"), "Asia/Kolkata"),
		).toEqual(at("2026-08-14T18:30:00.000Z"));
	});

	test.each([
		"2026-03-29T01:00:00.000Z",
		"2026-10-25T01:00:00.000Z",
	])("lands on local midnight across a DST switch (%s)", (iso) => {
		const midnight = startOfDayIn(at(iso), "Europe/Kyiv");
		const hour = new Intl.DateTimeFormat("en-CA", {
			timeZone: "Europe/Kyiv",
			hour12: false,
			hour: "2-digit",
		}).format(midnight);

		expect(Number(hour) % 24).toBe(0);
	});
});
