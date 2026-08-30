import { describe, expect, test } from "bun:test";
import { databaseUrlOf, describeTarget, targetOf } from "./up.database";

describe("reading the database target", () => {
	test("takes DATABASE_URL as it is", () => {
		expect(databaseUrlOf({ DATABASE_URL: " postgres://a/b " })).toBe(
			"postgres://a/b",
		);
	});

	test("treats an empty value as absent", () => {
		expect(databaseUrlOf({ DATABASE_URL: "  " })).toBeUndefined();
		expect(databaseUrlOf({})).toBeUndefined();
	});

	test("reads the host and port to probe", () => {
		expect(targetOf("postgres://recall:secret@127.0.0.1:55432/recall")).toEqual(
			{
				host: "127.0.0.1",
				port: 55432,
			},
		);
	});

	test("falls back to the standard port when the url omits it", () => {
		expect(targetOf("postgres://db.internal/recall")).toEqual({
			host: "db.internal",
			port: 5432,
		});
	});

	test("has no target for something it cannot parse", () => {
		expect(targetOf("nonsense")).toBeUndefined();
	});

	test("describes the target without its credentials", () => {
		expect(
			describeTarget("postgres://recall:secret@127.0.0.1:55432/recall"),
		).toBe("127.0.0.1:55432/recall");
	});

	test("says so rather than echoing something it cannot parse", () => {
		expect(describeTarget("nonsense")).toBe("(unparseable DATABASE_URL)");
	});
});
