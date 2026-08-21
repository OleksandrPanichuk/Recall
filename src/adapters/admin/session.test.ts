import { describe, expect, test } from "bun:test";
import { issueSession, readSession } from "./session";

const SECRET = "correct horse battery staple";
const NOW = new Date("2026-08-20T10:00:00.000Z");

describe("issueSession", () => {
	test("produces a cookie a browser will keep to itself", () => {
		const cookie = issueSession(SECRET, NOW);

		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Strict");
		expect(cookie).toContain("Path=/");
	});
});

describe("readSession", () => {
	const cookieOf = (cookie: string): string =>
		cookie.slice(cookie.indexOf("=") + 1, cookie.indexOf(";"));

	test("accepts a session it issued", () => {
		const value = cookieOf(issueSession(SECRET, NOW));

		expect(readSession(`admin=${value}`, SECRET, NOW)).toBe(true);
	});

	test("refuses a session signed with another secret", () => {
		const value = cookieOf(issueSession("another passphrase", NOW));

		expect(readSession(`admin=${value}`, SECRET, NOW)).toBe(false);
	});

	test("refuses a tampered expiry", () => {
		const value = cookieOf(issueSession(SECRET, NOW));
		const [expiry, signature] = value.split(".");
		const later = String(Number(expiry) + 60_000);

		expect(readSession(`admin=${later}.${signature}`, SECRET, NOW)).toBe(false);
	});

	test("refuses a session that has expired", () => {
		const value = cookieOf(issueSession(SECRET, NOW));
		const tomorrow = new Date("2026-08-22T10:00:00.000Z");

		expect(readSession(`admin=${value}`, SECRET, tomorrow)).toBe(false);
	});

	test("refuses nonsense and absence", () => {
		expect(readSession(undefined, SECRET, NOW)).toBe(false);
		expect(readSession("", SECRET, NOW)).toBe(false);
		expect(readSession("admin=garbage", SECRET, NOW)).toBe(false);
		expect(readSession("other=value", SECRET, NOW)).toBe(false);
	});

	test("finds its cookie among others", () => {
		const value = cookieOf(issueSession(SECRET, NOW));

		expect(readSession(`theme=dark; admin=${value}; x=1`, SECRET, NOW)).toBe(
			true,
		);
	});
});
