import { describe, expect, test } from "bun:test";
import { ApiErrorName, BotApiError } from "@recall/contracts";
import { messageFor } from "@/features/practice/lib/practice.errors";

describe("what practice says when an answer does not go through", () => {
	test("never leaves the reader without an explanation", () => {
		expect(messageFor(new Error("socket hang up"))).toContain(
			"reach the server",
		);
	});

	test("says the attempt is gone when it is", () => {
		expect(
			messageFor(
				new BotApiError(ApiErrorName.NoActiveAttempt, "gone", 409, {}),
			),
		).toContain("That attempt is gone");
	});

	test("falls back to something actionable for an unmapped refusal", () => {
		expect(
			messageFor(new BotApiError("QuizAttemptValidationError", "bad", 400, {})),
		).toContain("Try again");
	});
});
