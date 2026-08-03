import { describe, expect, test } from "bun:test";
import { brandedId } from "./branded-id";
import { InvalidIdentifierError } from "./quiz-set/quiz-set.errors";

describe("brandedId", () => {
	test("returns the trimmed value", () => {
		expect<string>(brandedId(" abc ", "QuestionId")).toBe("abc");
	});

	test.each(["", "   "])("rejects %p", (value) => {
		expect(() => brandedId(value, "QuestionId")).toThrow(
			InvalidIdentifierError,
		);
	});

	test("names the identifier in the failure message", () => {
		expect(() => brandedId("", "QuizSetId")).toThrow(
			"QuizSetId must be a non-empty identifier",
		);
	});
});
