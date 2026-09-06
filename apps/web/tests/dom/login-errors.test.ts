import { describe, expect, test } from "bun:test";
import { loginErrorFor } from "@/features/auth/constants/login-errors";

describe("what a failed login link tells the reader", () => {
	test("a spent or expired link says to ask the bot again", () => {
		expect(loginErrorFor("invalid_token")).toContain("/login");
	});

	test("an unknown telegram account is pointed at /start", () => {
		expect(loginErrorFor("unknown_user")).toContain("/start");
	});

	test("a failed session says to try the link again", () => {
		expect(loginErrorFor("session_failed")).toBeDefined();
	});

	test("every reason the api can redirect with has words for it", () => {
		for (const code of ["invalid_token", "unknown_user", "session_failed"]) {
			expect(loginErrorFor(code)).toBeDefined();
		}
	});

	test("and anything else says nothing rather than guessing", () => {
		expect(loginErrorFor("something_else")).toBeUndefined();
		expect(loginErrorFor(undefined)).toBeUndefined();
		expect(loginErrorFor(7)).toBeUndefined();
	});
});
