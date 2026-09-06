import { describe, expect, test } from "bun:test";
import { answerFor } from "@/shared/lib/session-answer";

const user = { user: { id: "u1", name: "Olia" } };

describe("what the api's answer about a session means", () => {
	test("200 with a user is that user", () => {
		expect(answerFor(200, user)).toEqual({
			kind: "viewer",
			viewer: { id: "u1", name: "Olia" },
		});
	});

	test("a user with no name still signs in", () => {
		expect(answerFor(200, { user: { id: "u1" } })).toEqual({
			kind: "viewer",
			viewer: { id: "u1", name: "You" },
		});
	});

	test("200 with no user is genuinely signed out", () => {
		expect(answerFor(200, null).kind).toBe("anonymous");
		expect(answerFor(200, {}).kind).toBe("anonymous");
	});

	test("401 is the api saying the session is no good", () => {
		expect(answerFor(401, undefined).kind).toBe("anonymous");
	});
});

describe("what it does not mean", () => {
	test("429 is not a logout — it is the api refusing to answer", () => {
		expect(answerFor(429, undefined)).toEqual({
			kind: "unknown",
			status: 429,
		});
	});

	test("neither is 500, 502 or 503", () => {
		for (const status of [500, 502, 503]) {
			expect(answerFor(status, undefined).kind).toBe("unknown");
		}
	});

	test("nor a 200 whose body could not be read", () => {
		expect(answerFor(200, undefined).kind).toBe("unknown");
	});

	test("a 429 that happens to carry a user is still not a sign-in", () => {
		expect(answerFor(429, user).kind).toBe("unknown");
	});
});
