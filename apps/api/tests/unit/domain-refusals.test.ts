import { describe, expect, test } from "bun:test";
import { InvalidIdentifierError } from "@/core/errors";
import {
	DuplicateResponseError,
	EmptyQuizAttemptError,
	QuizAttemptStatus,
	QuizAttemptTransitionError,
} from "@/modules/attempts";
import {
	DuplicateQuestionError,
	DuplicateQuestionIdError,
	QuizVersionConflictError,
	toQuestionId,
	toQuizSetId,
} from "@/modules/quizzes";
import { ModuleErrorFilter } from "@/shared/http/module-error.filter";
import { UnauthenticatedError } from "@/shared/request-context";

describe("domain errors that used to become a flat 500", () => {
	const cases: readonly [Error, number][] = [
		[new DuplicateQuestionError(["f1"]), 409],
		[new DuplicateQuestionIdError([toQuestionId("q1")]), 409],
		[new QuizVersionConflictError(toQuizSetId("s1")), 409],
		[
			new QuizAttemptTransitionError(QuizAttemptStatus.Completed, "answered"),
			409,
		],
		[new DuplicateResponseError(), 409],
		[new EmptyQuizAttemptError(), 400],
		[new UnauthenticatedError(), 401],
		[new InvalidIdentifierError("quiz set id"), 400],
	];

	for (const [error, status] of cases) {
		test(`${error.name} answers ${status} under its own name`, () => {
			expect(ModuleErrorFilter.refusalFor(error)).toMatchObject({
				status,
				name: error.name,
			});
		});
	}

	test("a version conflict names the set it is about", () => {
		expect(
			ModuleErrorFilter.refusalFor(
				new QuizVersionConflictError(toQuizSetId("s1")),
			)?.details,
		).toEqual({ quizSetId: "s1" });
	});
});
