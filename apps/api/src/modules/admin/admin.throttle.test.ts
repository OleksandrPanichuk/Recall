import { describe, expect, test } from "bun:test";
import {
	BASE_DELAY_MS,
	createSignInThrottle,
	delayAfter,
	FREE_ATTEMPTS,
	MAX_DELAY_MS,
} from "./admin.throttle";

describe("how long a refused passphrase waits", () => {
	test("a mistyped passphrase is not punished", () => {
		for (let attempt = 1; attempt <= FREE_ATTEMPTS; attempt += 1) {
			expect(delayAfter(attempt)).toBe(0);
		}
	});

	test("the first attempt past the allowance starts the delay", () => {
		expect(delayAfter(FREE_ATTEMPTS + 1)).toBe(BASE_DELAY_MS);
	});

	test("and it doubles from there", () => {
		expect(delayAfter(FREE_ATTEMPTS + 2)).toBe(BASE_DELAY_MS * 2);
		expect(delayAfter(FREE_ATTEMPTS + 3)).toBe(BASE_DELAY_MS * 4);
	});

	test("but stops doubling, so this is a brake and not a lockout", () => {
		expect(delayAfter(FREE_ATTEMPTS + 100)).toBe(MAX_DELAY_MS);
		expect(delayAfter(Number.MAX_SAFE_INTEGER)).toBe(MAX_DELAY_MS);
	});

	test("a thousand guesses cost hours, not seconds", () => {
		let total = 0;

		for (let attempt = 1; attempt <= 1000; attempt += 1) {
			total += delayAfter(attempt);
		}

		expect(total).toBeGreaterThan(4 * 60 * 60 * 1000);
	});
});

describe("the throttle across a sign-in session", () => {
	test("counts failures and hands back the wait", () => {
		const throttle = createSignInThrottle();

		for (let attempt = 1; attempt <= FREE_ATTEMPTS; attempt += 1) {
			expect(throttle.failed()).toBe(0);
		}

		expect(throttle.failed()).toBe(BASE_DELAY_MS);
		expect(throttle.failures).toBe(FREE_ATTEMPTS + 1);
	});

	test("a correct passphrase clears the debt, so the owner is never locked out", () => {
		const throttle = createSignInThrottle();

		for (let attempt = 0; attempt < 20; attempt += 1) {
			throttle.failed();
		}

		throttle.succeeded();

		expect(throttle.failures).toBe(0);
		expect(throttle.failed()).toBe(0);
	});
});
