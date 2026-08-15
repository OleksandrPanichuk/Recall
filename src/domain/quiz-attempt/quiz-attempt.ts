import {
	copiedDate,
	copiedOptionalDate,
	isValidDate,
} from "@/shared/utils/date";
import { brandedId } from "../branded-id";
import type { QuestionId } from "../quiz-set/question";
import { QuizAttemptStatus } from "./quiz-attempt.constants";
import {
	DuplicateResponseError,
	EmptyQuizAttemptError,
	QuestionNotInAttemptError,
	QuizAttemptTransitionError,
	QuizAttemptValidationError,
} from "./quiz-attempt.errors";
import type {
	QuestionResponse,
	QuizAttempt,
	QuizAttemptDraft,
	QuizAttemptId,
	QuizAttemptSnapshot,
} from "./quiz-attempt.types";
import {
	collectDraftIssues,
	collectResponseIssues,
	collectSnapshotIssues,
} from "./quiz-attempt.validation";
import { calculateScore, type Score } from "./score";

export {
	isQuizAttemptMode,
	isQuizAttemptStatus,
	QuizAttemptMode,
	QuizAttemptStatus,
} from "./quiz-attempt.constants";
export type {
	QuestionResponse,
	QuizAttempt,
	QuizAttemptDraft,
	QuizAttemptId,
	QuizAttemptSnapshot,
} from "./quiz-attempt.types";

export const toQuizAttemptId = (value: string): QuizAttemptId =>
	brandedId<"QuizAttemptId">(value, "QuizAttemptId");

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

const assertMutationDate = (
	attempt: QuizAttempt,
	at: Date,
	label: string,
): void => {
	if (!isValidDate(at)) {
		throw new QuizAttemptValidationError([`${label} must be a valid date`]);
	}

	if (at.getTime() < attempt.updatedAt.getTime()) {
		throw new QuizAttemptValidationError([
			`${label} must not precede updatedAt`,
		]);
	}
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

// Validates the snapshot rather than replaying transitions: pause and resume
// timestamps are not stored, so a replay would have to invent a zero-length
// pause/resume pair to land on a resumed attempt's `updatedAt`.
export function restoreQuizAttempt(snapshot: QuizAttemptSnapshot): QuizAttempt {
	if (snapshot.questionIds.length === 0) {
		throw new EmptyQuizAttemptError();
	}

	const issues = collectSnapshotIssues(snapshot);

	if (issues.length > 0) {
		throw new QuizAttemptValidationError(issues);
	}

	return frozenAttempt({
		id: snapshot.id,
		quizSetId: snapshot.quizSetId,
		telegramUserId: snapshot.telegramUserId,
		mode: snapshot.mode,
		status: snapshot.status,
		questionIds: snapshot.questionIds,
		responses: snapshot.responses,
		startedAt: snapshot.startedAt,
		updatedAt: snapshot.updatedAt,
		completedAt: snapshot.completedAt,
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
