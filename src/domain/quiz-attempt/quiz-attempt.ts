import { type BrandedId, brandedId } from "../branded-id";
import type { QuestionId, QuestionOptionId } from "../quiz-set/question";
import type { QuizSetId } from "../quiz-set/quiz-set";
import {
	DuplicateResponseError,
	EmptyQuizAttemptError,
	QuestionNotInAttemptError,
	QuizAttemptTransitionError,
	QuizAttemptValidationError,
} from "./quiz-attempt.errors";
import { calculateScore, type Score } from "./score";

export type QuizAttemptId = BrandedId<"QuizAttemptId">;

export const toQuizAttemptId = (value: string): QuizAttemptId =>
	brandedId<"QuizAttemptId">(value, "QuizAttemptId");

export const QuizAttemptStatus = {
	Active: "active",
	Paused: "paused",
	Completed: "completed",
} as const;
export type QuizAttemptStatus =
	(typeof QuizAttemptStatus)[keyof typeof QuizAttemptStatus];

export function isQuizAttemptStatus(
	value: unknown,
): value is QuizAttemptStatus {
	return (Object.values(QuizAttemptStatus) as readonly unknown[]).includes(
		value,
	);
}

export const QuizAttemptMode = {
	Full: "full",
	Mistakes: "mistakes",
	WeakTopics: "weak_topics",
} as const;
export type QuizAttemptMode =
	(typeof QuizAttemptMode)[keyof typeof QuizAttemptMode];

export function isQuizAttemptMode(value: unknown): value is QuizAttemptMode {
	return (Object.values(QuizAttemptMode) as readonly unknown[]).includes(value);
}

export interface QuestionResponse {
	readonly questionId: QuestionId;
	readonly selectedOptionIds: readonly QuestionOptionId[];
	readonly isCorrect: boolean;
	readonly answeredAt: Date;
}

export interface QuizAttempt {
	readonly id: QuizAttemptId;
	readonly quizSetId: QuizSetId;
	readonly telegramUserId: number;
	readonly mode: QuizAttemptMode;
	readonly status: QuizAttemptStatus;
	/** The ordered session plan; answers follow it strictly. */
	readonly questionIds: readonly QuestionId[];
	readonly responses: readonly QuestionResponse[];
	readonly startedAt: Date;
	readonly updatedAt: Date;
	readonly completedAt?: Date;
}

interface QuizAttemptDraft {
	readonly id: QuizAttemptId;
	readonly quizSetId: QuizSetId;
	readonly telegramUserId: number;
	readonly mode: QuizAttemptMode;
	readonly questionIds: readonly QuestionId[];
	readonly startedAt: Date;
}

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

/**
 * `Date` is mutable, so a stored reference would let a caller change a frozen
 * attempt's timestamps from the outside. Every timestamp is copied on the way
 * in; reference identity is deliberately not part of the contract.
 */
const copiedDate = (value: Date): Date => new Date(value.getTime());

const copiedOptionalDate = (value: Date | undefined): Date | undefined =>
	value === undefined ? undefined : copiedDate(value);

const hasDuplicates = (values: readonly string[]): boolean =>
	new Set(values).size !== values.length;

/**
 * A response may reach the aggregate as a plain object literal, so its nested
 * selection is frozen too. The array is copied before freezing so the caller's
 * array is never frozen and never aliased by the stored attempt.
 */
const frozenResponse = (response: QuestionResponse): QuestionResponse =>
	Object.freeze({
		...response,
		selectedOptionIds: Object.freeze([...response.selectedOptionIds]),
		answeredAt: copiedDate(response.answeredAt),
	});

const frozenAttempt = (fields: QuizAttempt): QuizAttempt =>
	Object.freeze({
		...fields,
		questionIds: Object.freeze([...fields.questionIds]),
		responses: Object.freeze(fields.responses.map(frozenResponse)),
		startedAt: copiedDate(fields.startedAt),
		updatedAt: copiedDate(fields.updatedAt),
		completedAt: copiedOptionalDate(fields.completedAt),
	});

const assertStatus = (
	attempt: QuizAttempt,
	allowed: readonly QuizAttemptStatus[],
	action: string,
): void => {
	if (!allowed.includes(attempt.status)) {
		throw new QuizAttemptTransitionError(attempt.status, action);
	}
};

/**
 * An invalid or backdated timestamp would silently corrupt the session
 * timeline, so every mutating function rejects it before touching the attempt.
 * A timestamp equal to `startedAt` is valid.
 */
const assertMutationDate = (
	attempt: QuizAttempt,
	at: Date,
	label: string,
): void => {
	if (!isValidDate(at)) {
		throw new QuizAttemptValidationError([`${label} must be a valid date`]);
	}

	if (at.getTime() < attempt.startedAt.getTime()) {
		throw new QuizAttemptValidationError([
			`${label} must not precede startedAt`,
		]);
	}
};

const collectDraftIssues = (draft: QuizAttemptDraft): readonly string[] => {
	const issues: string[] = [];

	if (
		!Number.isSafeInteger(draft.telegramUserId) ||
		draft.telegramUserId <= 0
	) {
		issues.push("telegramUserId must be a positive integer");
	}

	if (hasDuplicates(draft.questionIds)) {
		issues.push("questionIds must not contain duplicates");
	}

	if (!isValidDate(draft.startedAt)) {
		issues.push("startedAt must be a valid date");
	}

	return issues;
};

export function startQuizAttempt(draft: QuizAttemptDraft): QuizAttempt {
	if (draft.questionIds.length === 0) {
		throw new EmptyQuizAttemptError();
	}

	const issues = collectDraftIssues(draft);

	if (issues.length > 0) {
		throw new QuizAttemptValidationError(issues);
	}

	return frozenAttempt({
		id: draft.id,
		quizSetId: draft.quizSetId,
		telegramUserId: draft.telegramUserId,
		mode: draft.mode,
		status: QuizAttemptStatus.Active,
		questionIds: draft.questionIds,
		responses: [],
		startedAt: draft.startedAt,
		updatedAt: draft.startedAt,
	});
}

export function currentQuestionId(
	attempt: QuizAttempt,
): QuestionId | undefined {
	return attempt.questionIds[attempt.responses.length];
}

const collectResponseIssues = (
	response: QuestionResponse,
): readonly string[] => {
	const issues: string[] = [];

	if (response.selectedOptionIds.length === 0) {
		issues.push("selectedOptionIds must not be empty");
	}

	if (hasDuplicates(response.selectedOptionIds)) {
		issues.push("selectedOptionIds must not contain duplicates");
	}

	return issues;
};

/**
 * The idempotency guard for duplicated Telegram callbacks. An already answered
 * question is reported as a duplicate rather than as an out-of-order answer,
 * because that is the diagnosis the caller needs: the answer already landed.
 */
export function recordResponse(
	attempt: QuizAttempt,
	response: QuestionResponse,
): QuizAttempt {
	assertStatus(attempt, [QuizAttemptStatus.Active], "answered");
	assertMutationDate(attempt, response.answeredAt, "answeredAt");

	if (
		attempt.responses.some(
			(recorded) => recorded.questionId === response.questionId,
		)
	) {
		throw new DuplicateResponseError();
	}

	if (currentQuestionId(attempt) !== response.questionId) {
		throw new QuestionNotInAttemptError();
	}

	const issues = collectResponseIssues(response);

	if (issues.length > 0) {
		throw new QuizAttemptValidationError(issues);
	}

	return frozenAttempt({
		...attempt,
		responses: [...attempt.responses, response],
		updatedAt: response.answeredAt,
	});
}

export function pauseQuizAttempt(attempt: QuizAttempt, at: Date): QuizAttempt {
	assertStatus(attempt, [QuizAttemptStatus.Active], "paused");
	assertMutationDate(attempt, at, "at");

	return frozenAttempt({
		...attempt,
		status: QuizAttemptStatus.Paused,
		updatedAt: at,
	});
}

export function resumeQuizAttempt(attempt: QuizAttempt, at: Date): QuizAttempt {
	assertStatus(attempt, [QuizAttemptStatus.Paused], "resumed");
	assertMutationDate(attempt, at, "at");

	return frozenAttempt({
		...attempt,
		status: QuizAttemptStatus.Active,
		updatedAt: at,
	});
}

export function completeQuizAttempt(
	attempt: QuizAttempt,
	at: Date,
): QuizAttempt {
	assertStatus(
		attempt,
		[QuizAttemptStatus.Active, QuizAttemptStatus.Paused],
		"completed",
	);
	assertMutationDate(attempt, at, "at");

	return frozenAttempt({
		...attempt,
		status: QuizAttemptStatus.Completed,
		completedAt: at,
		updatedAt: at,
	});
}

export function attemptScore(attempt: QuizAttempt): Score {
	return calculateScore(attempt.responses, attempt.questionIds.length);
}
