import { describe, expect, test } from "bun:test";
import { copiedDate, copiedOptionalDate, isValidDate } from "./date";

describe("isValidDate", () => {
	test("accepts a parsable date", () => {
		expect(isValidDate(new Date("2024-01-01T00:00:00.000Z"))).toBe(true);
	});

	test("rejects an unparsable date", () => {
		expect(isValidDate(new Date("not-a-date"))).toBe(false);
	});
});

describe("copiedDate", () => {
	test("returns an equal but distinct instance", () => {
		const original = new Date("2024-01-01T00:00:00.000Z");
		const copy = copiedDate(original);

		expect(copy).not.toBe(original);
		expect(copy.getTime()).toBe(original.getTime());
	});

	test("does not observe later mutation of the source", () => {
		const original = new Date("2024-01-01T00:00:00.000Z");
		const copy = copiedDate(original);

		original.setUTCFullYear(2030);

		expect(copy.toISOString()).toBe("2024-01-01T00:00:00.000Z");
	});

	test("preserves an invalid date", () => {
		expect(Number.isNaN(copiedDate(new Date("not-a-date")).getTime())).toBe(
			true,
		);
	});
});

describe("copiedOptionalDate", () => {
	test("returns undefined for undefined", () => {
		expect(copiedOptionalDate(undefined)).toBeUndefined();
	});

	test("copies a present date", () => {
		const original = new Date("2024-01-01T00:00:00.000Z");
		const copy = copiedOptionalDate(original);

		expect(copy).not.toBe(original);
		expect(copy?.getTime()).toBe(original.getTime());
	});
});
