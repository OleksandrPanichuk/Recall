import type { QuizAttemptStatus } from "./quiz-attempt";

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

export class QuizAttemptTransitionError extends Error {
	constructor(from: QuizAttemptStatus, action: string) {
		super(`A ${from} attempt cannot be ${action}`);
		this.name = "QuizAttemptTransitionError";
	}
}

export class EmptyQuizAttemptError extends Error {
	constructor() {
		super("An attempt requires at least one question");
		this.name = "EmptyQuizAttemptError";
	}
}

export class QuestionNotInAttemptError extends Error {
	constructor() {
		super("An attempt can only answer its current planned question");
		this.name = "QuestionNotInAttemptError";
	}
}

export class DuplicateResponseError extends Error {
	constructor() {
		super("An attempt cannot answer the same question twice");
		this.name = "DuplicateResponseError";
	}
}
