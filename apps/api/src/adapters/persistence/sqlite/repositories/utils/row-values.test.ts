import { describe, expect, test } from "bun:test";
import { createRowValueParsers } from "./row-values";

class TestRowError extends Error {
	readonly id: string;
	readonly issues: readonly string[];

	constructor(id: string, issues: readonly string[]) {
		super(`${id}: ${issues.join(", ")}`);
		this.name = "TestRowError";
		this.id = id;
		this.issues = issues;
	}
}

const parsers = createRowValueParsers(
	(id, issues) => new TestRowError(id, issues),
);

describe("requiredDate", () => {
	test("parses an ISO timestamp", () => {
		expect(
			parsers.requiredDate("2026-08-01T00:00:00.000Z", "created_at", "row-1"),
		).toEqual(new Date("2026-08-01T00:00:00.000Z"));
	});

	test("throws the injected error for an unparsable value", () => {
		expect(() =>
			parsers.requiredDate("not-a-date", "created_at", "row-1"),
		).toThrow(TestRowError);
	});

	test("reports the column and the row id on failure", () => {
		try {
			parsers.requiredDate("not-a-date", "created_at", "row-1");
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(TestRowError);
			expect((error as TestRowError).id).toBe("row-1");
			expect((error as TestRowError).issues).toEqual([
				"created_at must be a valid ISO timestamp",
			]);
		}
	});
});

describe("optionalDate", () => {
	test("maps null to undefined", () => {
		expect(parsers.optionalDate(null, "completed_at", "row-1")).toBeUndefined();
	});

	test("parses a present timestamp", () => {
		expect(
			parsers.optionalDate("2026-08-01T00:00:00.000Z", "completed_at", "row-1"),
		).toEqual(new Date("2026-08-01T00:00:00.000Z"));
	});

	test("throws the injected error for an unparsable value", () => {
		expect(() =>
			parsers.optionalDate("not-a-date", "completed_at", "row-1"),
		).toThrow(TestRowError);
	});
});

describe("parseStringArray", () => {
	test("parses a JSON array of strings", () => {
		expect(parsers.parseStringArray('["a","b"]', "tags", "row-1")).toEqual([
			"a",
			"b",
		]);
	});

	test("parses an empty array", () => {
		expect(parsers.parseStringArray("[]", "tags", "row-1")).toEqual([]);
	});

	test("rejects invalid JSON", () => {
		try {
			parsers.parseStringArray("{", "tags", "row-1");
			expect.unreachable();
		} catch (error) {
			expect((error as TestRowError).issues).toEqual([
				"tags must be a JSON array",
			]);
		}
	});

	test("rejects a JSON value that is not an array", () => {
		try {
			parsers.parseStringArray('{"a":1}', "tags", "row-1");
			expect.unreachable();
		} catch (error) {
			expect((error as TestRowError).issues).toEqual([
				"tags must be a JSON array of strings",
			]);
		}
	});

	test("rejects an array holding a non-string entry", () => {
		try {
			parsers.parseStringArray('["a",1]', "tags", "row-1");
			expect.unreachable();
		} catch (error) {
			expect((error as TestRowError).issues).toEqual([
				"tags must be a JSON array of strings",
			]);
		}
	});
});
