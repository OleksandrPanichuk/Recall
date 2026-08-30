import { describe, expect, test } from "bun:test";
import { matchesSecret } from "./secret";

describe("comparing a presented secret with the expected one", () => {
	test("accepts the same secret", () => {
		expect(matchesSecret("a-long-shared-secret", "a-long-shared-secret")).toBe(
			true,
		);
	});

	test("refuses a different one of the same length", () => {
		expect(matchesSecret("aaaaaaaaaaaa", "aaaaaaaaaaab")).toBe(false);
	});

	test("refuses a different length without throwing", () => {
		expect(matchesSecret("short", "a-much-longer-secret")).toBe(false);
	});

	test("refuses an empty presented value, and an empty expected one", () => {
		expect(matchesSecret("", "expected")).toBe(false);
		expect(matchesSecret("presented", "")).toBe(false);
		expect(matchesSecret("", "")).toBe(false);
	});
});
