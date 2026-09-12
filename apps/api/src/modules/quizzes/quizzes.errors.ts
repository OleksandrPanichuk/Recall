import type { QuestionId } from "./question.entity.types";
import type { QuizSetStatus } from "./quiz-set.constants";
import type { QuizSetId } from "./quiz-set.entity.types";

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

export class QuizVersionConflictError extends Error {
	readonly quizId: QuizSetId;

	constructor(quizId: QuizSetId) {
		super(
			`Quiz ${quizId} changed since it was read; re-read it and apply the change again`,
		);
		this.name = "QuizVersionConflictError";
		this.quizId = quizId;
	}
}

export class AnsweredQuestionError extends Error {
	readonly questionId: QuestionId;
	readonly answers: number;

	constructor(questionId: QuestionId, answers: number) {
		super(
			`Question ${questionId} has ${answers} recorded answers; deleting it would take them with it. Edit it instead.`,
		);
		this.name = "AnsweredQuestionError";
		this.questionId = questionId;
		this.answers = answers;
	}
}

export class QuestionNotFoundError extends Error {
	readonly quizSetId: QuizSetId;
	readonly questionId: QuestionId;

	constructor(quizSetId: QuizSetId, questionId: QuestionId) {
		super(`Quiz set ${quizSetId} has no question ${questionId}`);
		this.name = "QuestionNotFoundError";
		this.quizSetId = quizSetId;
		this.questionId = questionId;
	}
}

export class QuizSetNotFoundError extends Error {
	readonly quizSetId: QuizSetId;

	constructor(quizSetId: QuizSetId) {
		super(`Quiz set ${quizSetId} does not exist`);
		this.name = "QuizSetNotFoundError";
		this.quizSetId = quizSetId;
	}
}

export class EmptyQuestionBatchError extends Error {
	constructor() {
		super("A question batch must contain at least one question");
		this.name = "EmptyQuestionBatchError";
	}
}

export class QuestionBatchTooLargeError extends Error {
	constructor(size: number, limit: number) {
		super(`A question batch of ${size} exceeds the limit of ${limit}`);
		this.name = "QuestionBatchTooLargeError";
	}
}
