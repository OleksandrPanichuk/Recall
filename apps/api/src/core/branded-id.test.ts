import { describe, expect, test } from "bun:test";
import { type BrandedId, brandedId } from "./branded-id";
import { InvalidIdentifierError } from "./errors";

type LeftId = BrandedId<"LeftId">;
type RightId = BrandedId<"RightId">;

function assertBrandsAreDistinct(id: LeftId): RightId {
	// @ts-expect-error two brands over the same string must not be interchangeable.
	return id;
}

void assertBrandsAreDistinct;

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
