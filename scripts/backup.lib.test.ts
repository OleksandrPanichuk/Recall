import { describe, expect, test } from "bun:test";
import {
	looksLikeDump,
	newestStamp,
	postgresTargetFrom,
	prunable,
	stampFor,
	stampsIn,
} from "./backup.lib";

describe("naming a backup", () => {
	test("sorts lexicographically because it is UTC and fixed width", () => {
		const early = stampFor(new Date("2026-01-02T03:04:05Z"));
		const late = stampFor(new Date("2026-01-02T03:04:06Z"));

		expect(early).toBe("20260102-030405");
		expect(early < late).toBe(true);
	});

	test("pads a single-digit month, or December would sort before February", () => {
		expect(stampFor(new Date("2026-02-01T00:00:00Z"))).toBe("20260201-000000");
		expect(
			stampFor(new Date("2026-02-01T00:00:00Z")) <
				stampFor(new Date("2026-12-01T00:00:00Z")),
		).toBe(true);
	});

	test("is UTC, so a backup taken across a DST change still sorts", () => {
		expect(stampFor(new Date("2026-03-29T00:30:00Z"))).toBe("20260329-003000");
	});
});

describe("reading a backup directory", () => {
	const names = [
		"20260101-120000",
		"README.md",
		"20260103-090000",
		".DS_Store",
		"20260102-235959",
	];

	test("ignores anything that is not a stamp", () => {
		expect(stampsIn(names)).toEqual([
			"20260101-120000",
			"20260102-235959",
			"20260103-090000",
		]);
	});

	test("the newest is the one restore reaches for", () => {
		expect(newestStamp(names)).toBe("20260103-090000");
	});

	test("an empty directory has no newest, rather than a bad guess", () => {
		expect(newestStamp(["README.md"])).toBeUndefined();
	});
});

describe("pruning old backups", () => {
	const names = [
		"20260101-120000",
		"20260102-120000",
		"20260103-120000",
		"20260104-120000",
	];

	test("keeps the newest n and names the rest", () => {
		expect(prunable(names, 2)).toEqual(["20260101-120000", "20260102-120000"]);
	});

	test("prunes nothing when there is nothing to spare", () => {
		expect(prunable(names, 4)).toEqual([]);
		expect(prunable(names, 10)).toEqual([]);
	});

	test("keeping zero means keeping zero, not keeping everything", () => {
		expect(prunable(names, 0)).toEqual(names);
	});

	test("never prunes a file it does not recognise", () => {
		expect(prunable([...names, "keep-me.txt"], 0)).toEqual(names);
	});
});

describe("which database gets dumped", () => {
	test("the one DATABASE_URL names, which is not always `recall`", () => {
		expect(
			postgresTargetFrom("postgres://recall:recall@127.0.0.1:55432/recall_dev"),
		).toEqual({ user: "recall", database: "recall_dev" });
	});

	test("the compose default when nothing is configured", () => {
		expect(postgresTargetFrom(undefined)).toEqual({
			user: "recall",
			database: "recall",
		});
	});

	test("and when the url is unparseable, rather than dumping nothing", () => {
		expect(postgresTargetFrom("not a url").database).toBe("recall");
	});

	test("a url with no database falls back rather than passing an empty name", () => {
		expect(postgresTargetFrom("postgres://someone@host:5432/").database).toBe(
			"recall",
		);
	});

	test("percent-escapes in the credentials are decoded", () => {
		expect(postgresTargetFrom("postgres://a%40b:pw@host:5432/my%20db")).toEqual(
			{ user: "a@b", database: "my db" },
		);
	});
});

describe("telling a dump from whatever else landed in the file", () => {
	const real = [
		"--",
		"-- PostgreSQL database dump",
		"--",
		"SET statement_timeout = 0;",
	].join("\n");

	test("accepts what pg_dump actually writes", () => {
		expect(looksLikeDump(real)).toBe(true);
	});

	test("accepts a dump of a database with no tables in it yet", () => {
		expect(
			looksLikeDump("--\n-- PostgreSQL database dump\n--\n\n--\n-- complete\n"),
		).toBe(true);
	});

	test("rejects a stringified stream, which is what a bad pipe leaves", () => {
		expect(looksLikeDump("[object ReadableStream]")).toBe(false);
	});

	test("rejects an empty file", () => {
		expect(looksLikeDump("")).toBe(false);
	});

	test("rejects an error message that happened to be captured", () => {
		expect(looksLikeDump("pg_dump: error: connection failed")).toBe(false);
	});
});
