import { HttpStatus } from "@nestjs/common";
import { ModuleError } from "@/core/errors";
import type { QuizAttemptStatus } from "./attempts.constants";

export class QuizAttemptValidationError extends Error {
	readonly issues: readonly string[];

	constructor(issues: readonly string[]) {
		super(
			`Invalid quiz attempt:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
		);
		this.name = "QuizAttemptValidationError";
		this.issues = issues;
	}
}

export class QuizAttemptTransitionError extends ModuleError {
	readonly status = HttpStatus.CONFLICT;
	readonly code = "ATTEMPT_TRANSITION";

	constructor(from: QuizAttemptStatus, action: string) {
		super(`A ${from} attempt cannot be ${action}`);
	}
}

export class EmptyQuizAttemptError extends ModuleError {
	readonly status = HttpStatus.BAD_REQUEST;
	readonly code = "ATTEMPT_EMPTY";

	constructor() {
		super("An attempt requires at least one question");
	}
}

export class QuestionNotInAttemptError extends Error {
	constructor() {
		super("An attempt can only answer its current planned question");
		this.name = "QuestionNotInAttemptError";
	}
}

export class DuplicateResponseError extends ModuleError {
	readonly status = HttpStatus.CONFLICT;
	readonly code = "RESPONSE_DUPLICATE";

	constructor() {
		super("An attempt cannot answer the same question twice");
	}
}
