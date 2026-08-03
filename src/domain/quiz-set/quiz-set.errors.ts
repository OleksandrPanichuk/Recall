export class InvalidIdentifierError extends Error {
	constructor(label: string) {
		super(`${label} must be a non-empty identifier`);
		this.name = "InvalidIdentifierError";
	}
}

export class QuestionValidationError extends Error {
	readonly issues: readonly string[];

	constructor(issues: readonly string[]) {
		super(
			`Invalid question:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
		);
		this.name = "QuestionValidationError";
		this.issues = issues;
	}
}

export class QuizSetValidationError extends Error {
	readonly issues: readonly string[];

	constructor(issues: readonly string[]) {
		super(
			`Invalid quiz set:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
		);
		this.name = "QuizSetValidationError";
		this.issues = issues;
	}
}

/**
 * `from` is an already validated lifecycle status, never a rejected
 * user-supplied value, so naming it in the message is safe.
 */
export class QuizSetTransitionError extends Error {
	constructor(from: string, action: string) {
		super(`A ${from} quiz set cannot be ${action}`);
		this.name = "QuizSetTransitionError";
	}
}

/**
 * Carries the offending content fingerprints — opaque hashes, not the rejected
 * question text — so a retried import batch can be diagnosed.
 */
export class DuplicateQuestionError extends Error {
	readonly fingerprints: readonly string[];

	constructor(fingerprints: readonly string[]) {
		super(
			`A quiz set cannot contain duplicate questions:\n${fingerprints
				.map((fingerprint) => `- ${fingerprint}`)
				.join("\n")}`,
		);
		this.name = "DuplicateQuestionError";
		this.fingerprints = fingerprints;
	}
}

export class EmptyQuizSetError extends Error {
	constructor() {
		super("A quiz set without questions cannot be published");
		this.name = "EmptyQuizSetError";
	}
}
