import { describe, expect, test } from "bun:test";
import { ModuleError } from "./errors";

class QuizSetNotFoundError extends ModuleError {
	readonly status = 404;
	readonly code = "QUIZ_SET_NOT_FOUND";

	constructor(private readonly quizSetId: string) {
		super(`Quiz set ${quizSetId} was not found`);
	}

	override details(): Readonly<Record<string, string>> {
		return { quizSetId: this.quizSetId };
	}
}

class PlainError extends ModuleError {
	readonly status = 409;
	readonly code = "PLAIN";
}

describe("ModuleError", () => {
	test("takes its name from the subclass, which is what the wire carries", () => {
		expect(new QuizSetNotFoundError("q1").name).toBe("QuizSetNotFoundError");
	});

	test("carries the status and code the transport needs", () => {
		const error = new QuizSetNotFoundError("q1");

		expect(error.status).toBe(404);
		expect(error.code).toBe("QUIZ_SET_NOT_FOUND");
	});

	test("exposes only the details the subclass chose", () => {
		expect(new QuizSetNotFoundError("q1").details()).toEqual({
			quizSetId: "q1",
		});
	});

	test("exposes nothing when the subclass names no details", () => {
		expect(new PlainError("nope").details()).toBeUndefined();
	});

	test("is an Error, so instanceof and stack still work", () => {
		const error = new PlainError("nope");

		expect(error).toBeInstanceOf(Error);
		expect(error.message).toBe("nope");
		expect(error.stack).toBeString();
	});
});
