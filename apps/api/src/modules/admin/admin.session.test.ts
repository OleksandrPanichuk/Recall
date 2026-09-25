import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { AdminSessions } from "./admin.session";

const SECRET = "correct horse battery staple";
const NOW = new Date("2026-08-20T10:00:00.000Z");

const cookieValueOf = (cookie: string): string =>
	cookie.slice(cookie.indexOf("=") + 1, cookie.indexOf(";"));

describe("issuing a session", () => {
	const sessions = new AdminSessions(SECRET);

	test("produces a cookie a browser will keep to itself", () => {
		const cookie = sessions.issue(NOW);

		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Strict");
		expect(cookie).toContain("Path=/");
	});

	test("is not marked Secure over plain http, or localhost would drop it", () => {
		expect(sessions.issue(NOW)).not.toContain("Secure");
	});

	test("is marked Secure when the request arrived over https", () => {
		expect(sessions.issue(NOW, true)).toContain("Secure");
	});

	test("and clearing it carries the same flag, or the browser keeps the old one", () => {
		expect(AdminSessions.cleared(true)).toContain("Secure");
		expect(AdminSessions.cleared()).not.toContain("Secure");
	});

	test("is not signed with the passphrase itself", () => {
		const [id, expiry, signature] = cookieValueOf(sessions.issue(NOW)).split(
			".",
		);
		const naive = createHmac("sha256", SECRET)
			.update(`${id}.${expiry}`)
			.digest("base64url");
		const naiveExpiryOnly = createHmac("sha256", SECRET)
			.update(String(expiry))
			.digest("base64url");

		expect(signature).not.toBe(naive);
		expect(signature).not.toBe(naiveExpiryOnly);
	});
});

describe("reading a session", () => {
	test("accepts a session it issued", () => {
		const sessions = new AdminSessions(SECRET);
		const value = cookieValueOf(sessions.issue(NOW));

		expect(sessions.read(`admin=${value}`, NOW)).toBe(true);
	});

	test("refuses a session another instance issued, even with the same passphrase", () => {
		const value = cookieValueOf(new AdminSessions(SECRET).issue(NOW));

		expect(new AdminSessions(SECRET).read(`admin=${value}`, NOW)).toBe(false);
	});

	test("refuses a tampered expiry", () => {
		const sessions = new AdminSessions(SECRET);
		const [id, expiry, signature] = cookieValueOf(sessions.issue(NOW)).split(
			".",
		);
		const later = String(Number(expiry) + 60_000);

		expect(sessions.read(`admin=${id}.${later}.${signature}`, NOW)).toBe(false);
	});

	test("refuses a session that has expired", () => {
		const sessions = new AdminSessions(SECRET);
		const value = cookieValueOf(sessions.issue(NOW));
		const tomorrow = new Date("2026-08-22T10:00:00.000Z");

		expect(sessions.read(`admin=${value}`, tomorrow)).toBe(false);
	});

	test("refuses nonsense and absence", () => {
		const sessions = new AdminSessions(SECRET);

		expect(sessions.read(undefined, NOW)).toBe(false);
		expect(sessions.read("", NOW)).toBe(false);
		expect(sessions.read("admin=garbage", NOW)).toBe(false);
		expect(sessions.read("admin=a.b.c", NOW)).toBe(false);
		expect(sessions.read("other=value", NOW)).toBe(false);
	});

	test("finds its cookie among others", () => {
		const sessions = new AdminSessions(SECRET);
		const value = cookieValueOf(sessions.issue(NOW));

		expect(sessions.read(`theme=dark; admin=${value}; x=1`, NOW)).toBe(true);
	});
});

describe("ending a session", () => {
	test("expires the same cookie the sign-in issued", () => {
		const cleared = AdminSessions.cleared();

		expect(cleared).toStartWith("admin=;");
		expect(cleared).toContain("Path=/");
		expect(cleared).toContain("Max-Age=0");
	});

	test("an empty cookie is not accepted as a session", () => {
		expect(new AdminSessions(SECRET).read("admin=", NOW)).toBe(false);
	});

	test("a copy of the cookie is worthless once its session signed out", () => {
		const sessions = new AdminSessions(SECRET);
		const header = `admin=${cookieValueOf(sessions.issue(NOW))}`;

		sessions.end(header);

		expect(sessions.read(header, NOW)).toBe(false);
	});

	test("signing one session out leaves another signed in", () => {
		const sessions = new AdminSessions(SECRET);
		const laptop = `admin=${cookieValueOf(sessions.issue(NOW))}`;
		const phone = `admin=${cookieValueOf(sessions.issue(NOW))}`;

		sessions.end(laptop);

		expect(sessions.read(phone, NOW)).toBe(true);
	});

	test("a forged cookie cannot end somebody else's session", () => {
		const sessions = new AdminSessions(SECRET);
		const header = `admin=${cookieValueOf(sessions.issue(NOW))}`;
		const [id] = cookieValueOf(header).split(".");

		sessions.end(`admin=${id}.0.forged`);

		expect(sessions.read(header, NOW)).toBe(true);
	});
});
