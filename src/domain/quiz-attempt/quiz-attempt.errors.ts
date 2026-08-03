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

/**
 * `from` is an already validated lifecycle status, never a rejected
 * user-supplied value, so naming it in the message is safe.
 */
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

/**
 * Raised both for a question absent from the session plan and for one answered
 * out of turn. The rejected question id arrives from an untrusted Telegram
 * callback, so it is deliberately not echoed into the message.
 */
export class QuestionNotInAttemptError extends Error {
	constructor() {
		super("An attempt can only answer its current planned question");
		this.name = "QuestionNotInAttemptError";
	}
}

/**
 * The guard against a duplicated Telegram callback: the same question must be
 * scored exactly once per attempt.
 */
export class DuplicateResponseError extends Error {
	constructor() {
		super("An attempt cannot answer the same question twice");
		this.name = "DuplicateResponseError";
	}
}
