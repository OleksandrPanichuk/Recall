import { describe, expect, test } from "bun:test";
import { ModuleError } from "@/core/errors";
import { refusalFor } from "./module-error.filter";

class QuizSetArchivedError extends ModuleError {
	readonly status = 409;
	readonly code = "QUIZ_SET_ARCHIVED";

	constructor(private readonly quizSetId: string) {
		super("an archived quiz set cannot be published");
	}

	override details(): Readonly<Record<string, string>> {
		return { quizSetId: this.quizSetId };
	}
}

class LegacyQuizSetNotFoundError extends Error {
	readonly quizSetId = "q7";
	readonly secret = "must not travel";

	constructor() {
		super("Quiz set q7 was not found");
		this.name = "QuizSetNotFoundError";
	}
}

describe("refusalFor", () => {
	test("reads a module error off the class", () => {
		expect(refusalFor(new QuizSetArchivedError("q1"))).toEqual({
			status: 409,
			name: "QuizSetArchivedError",
			message: "an archived quiz set cannot be published",
			details: { quizSetId: "q1" },
		});
	});

	test("still reads a v1 domain error out of the name table", () => {
		expect(refusalFor(new LegacyQuizSetNotFoundError())).toEqual({
			status: 404,
			name: "QuizSetNotFoundError",
			message: "Quiz set q7 was not found",
			details: { quizSetId: "q7" },
		});
	});

	test("carries only whitelisted details off a v1 error", () => {
		expect(
			refusalFor(new LegacyQuizSetNotFoundError())?.details,
		).not.toHaveProperty("secret");
	});

	test("sends the class name, because the bot maps refusals by name", () => {
		expect(refusalFor(new QuizSetArchivedError("q1"))?.name).toBe(
			"QuizSetArchivedError",
		);
	});

	test("refuses to guess at an error it does not recognise", () => {
		expect(refusalFor(new Error("something broke"))).toBeUndefined();
		expect(refusalFor("a thrown string")).toBeUndefined();
	});

	test("a module error needs no entry in the name table", () => {
		expect(refusalFor(new QuizSetArchivedError("q1"))?.status).toBe(409);
	});
});
