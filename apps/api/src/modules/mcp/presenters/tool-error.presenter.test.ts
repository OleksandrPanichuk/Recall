import { describe, expect, test } from "bun:test";
import {
	DuplicateQuestionIdError,
	QuizVersionConflictError,
	toQuestionId,
	toQuizSetId,
} from "@/modules/quizzes";
import { describeError } from "./tool-error.presenter";

describe("describeError", () => {
	test("tells the model to re-read a set that changed under it", () => {
		const text = describeError(new QuizVersionConflictError(toQuizSetId("s1")));

		expect(text).not.toContain("Unexpected error");
		expect(text).toContain("quiz_get_set");
	});

	test("names the question ids a batch repeated", () => {
		const text = describeError(
			new DuplicateQuestionIdError([toQuestionId("q1"), toQuestionId("q2")]),
		);

		expect(text).not.toContain("Unexpected error");
		expect(text).toContain("q1, q2");
	});
});
