import { describe, expect, test } from "bun:test";
import { bearerTokenOf, matchesToken } from "./bearer";

const TOKEN = "a".repeat(40);

describe("bearerTokenOf", () => {
	test("reads the token out of the header", () => {
		expect(bearerTokenOf(`Bearer ${TOKEN}`)).toBe(TOKEN);
	});

	test("accepts the scheme in any case", () => {
		expect(bearerTokenOf(`bearer ${TOKEN}`)).toBe(TOKEN);
		expect(bearerTokenOf(`BEARER ${TOKEN}`)).toBe(TOKEN);
	});

	test("tolerates extra whitespace around the token", () => {
		expect(bearerTokenOf(`Bearer   ${TOKEN}  `)).toBe(TOKEN);
	});

	test("has nothing to read without a header", () => {
		expect(bearerTokenOf(null)).toBeUndefined();
	});

	test("refuses another scheme", () => {
		expect(bearerTokenOf(`Basic ${TOKEN}`)).toBeUndefined();
	});

	test("refuses a scheme with no token behind it", () => {
		expect(bearerTokenOf("Bearer")).toBeUndefined();
		expect(bearerTokenOf("Bearer    ")).toBeUndefined();
	});

	test("refuses a bare token with no scheme", () => {
		expect(bearerTokenOf(TOKEN)).toBeUndefined();
	});
});

describe("matchesToken", () => {
	test("accepts the configured token", () => {
		expect(matchesToken(TOKEN, TOKEN)).toBe(true);
	});

	test("refuses a different token of the same length", () => {
		expect(matchesToken("b".repeat(40), TOKEN)).toBe(false);
	});

	test("refuses a token that only shares a prefix", () => {
		expect(matchesToken("a".repeat(39), TOKEN)).toBe(false);
	});

	test("refuses a longer token that starts correctly", () => {
		expect(matchesToken(`${TOKEN}b`, TOKEN)).toBe(false);
	});

	test("refuses an empty token", () => {
		expect(matchesToken("", TOKEN)).toBe(false);
	});
});
