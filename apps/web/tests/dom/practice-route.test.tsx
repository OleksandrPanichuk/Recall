import { describe, expect, test } from "bun:test";

const { Route } = await import("@/routes/practice.$quizId");

describe("the practice route", () => {
	test("is never preloaded, because loading it starts an attempt", () => {
		expect(Route.options.preload).toBe(false);
	});
});
