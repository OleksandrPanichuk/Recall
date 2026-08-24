import { describe, expect, test } from "bun:test";
import { describeDatabaseUrl } from "./database-url";

describe("describeDatabaseUrl", () => {
	test("keeps the host, port and database, and drops the password", () => {
		expect(
			describeDatabaseUrl("postgres://recall:s3cret@127.0.0.1:55432/recall"),
		).toBe("postgres://recall@127.0.0.1:55432/recall");
	});

	test("survives a url with no credentials", () => {
		expect(describeDatabaseUrl("postgres://db.internal/recall")).toBe(
			"postgres://db.internal/recall",
		);
	});

	test("says so rather than echoing something it cannot parse", () => {
		expect(describeDatabaseUrl("not a url")).toBe("(unparseable)");
	});
});
