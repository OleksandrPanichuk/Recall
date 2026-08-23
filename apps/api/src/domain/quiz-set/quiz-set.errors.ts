import type { QuestionId } from "./question";
import type { QuizSetStatus } from "./quiz-set.constants";

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

export class QuizSetTransitionError extends Error {
	constructor(from: QuizSetStatus, action: string) {
		super(`A ${from} quiz set cannot be ${action}`);
		this.name = "QuizSetTransitionError";
	}
}

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

export class DuplicateQuestionIdError extends Error {
	readonly questionIds: readonly QuestionId[];

	constructor(questionIds: readonly QuestionId[]) {
		super(
			`A quiz set cannot contain duplicate question ids:\n${questionIds
				.map((questionId) => `- ${questionId}`)
				.join("\n")}`,
		);
		this.name = "DuplicateQuestionIdError";
		this.questionIds = questionIds;
	}
}

export class EmptyQuizSetError extends Error {
	constructor() {
		super("A quiz set needs at least one question");
		this.name = "EmptyQuizSetError";
	}
}
