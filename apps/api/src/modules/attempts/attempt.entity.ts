import { brandedId } from "@/core/branded-id";
import { type QuestionId, type QuizSetId } from "@/modules/quizzes";
import { RecallGrade } from "@/modules/scheduling";
import {
	copiedDate,
	copiedOptionalDate,
	isValidDate,
} from "@/shared/utils/date";
import type {
	AttemptDraft,
	AttemptSnapshot,
	QuestionResponse,
	QuizAttemptId,
} from "./attempt.entity.types";
import {
	collectDraftIssues,
	collectResponseIssues,
	collectSnapshotIssues,
} from "./attempt.entity.validation";
import { type QuizAttemptMode, QuizAttemptStatus } from "./attempts.constants";
import {
	DuplicateResponseError,
	EmptyQuizAttemptError,
	QuestionNotInAttemptError,
	QuizAttemptTransitionError,
	QuizAttemptValidationError,
} from "./attempts.errors";
import { Score } from "./score";

export type {
	AttemptDraft,
	AttemptSnapshot,
	QuestionResponse,
	QuizAttemptId,
} from "./attempt.entity.types";
export {
	isQuizAttemptMode,
	isQuizAttemptStatus,
	QuizAttemptMode,
	QuizAttemptStatus,
} from "./attempts.constants";

export const toQuizAttemptId = (value: string): QuizAttemptId =>
	brandedId<"QuizAttemptId">(value, "QuizAttemptId");

const frozenResponse = (response: QuestionResponse): QuestionResponse =>
	Object.freeze({
		...response,
		selectedOptionIds: Object.freeze([...response.selectedOptionIds]),
		answeredAt: copiedDate(response.answeredAt),
	});

const frozen = (fields: AttemptEntity): AttemptEntity =>
	Object.freeze({
		...fields,
		questionIds: Object.freeze([...fields.questionIds]),
		responses: Object.freeze(fields.responses.map(frozenResponse)),
		startedAt: copiedDate(fields.startedAt),
		updatedAt: copiedDate(fields.updatedAt),
		completedAt: copiedOptionalDate(fields.completedAt),
	});

const assertStatus = (
	attempt: AttemptEntity,
	allowed: readonly QuizAttemptStatus[],
	action: string,
): void => {
	if (!allowed.includes(attempt.status)) {
		throw new QuizAttemptTransitionError(attempt.status, action);
	}
};

const assertMutationDate = (
	attempt: AttemptEntity,
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

export interface AttemptEntity {
	readonly id: QuizAttemptId;
	readonly quizSetId: QuizSetId;
	readonly telegramUserId?: number;
	readonly mode: QuizAttemptMode;
	readonly status: QuizAttemptStatus;
	readonly questionIds: readonly QuestionId[];
	readonly responses: readonly QuestionResponse[];
	readonly startedAt: Date;
	readonly updatedAt: Date;
	readonly completedAt?: Date;
}

export class AttemptEntity {
	private constructor() {}

	static start(draft: AttemptDraft): AttemptEntity {
		if (draft.questionIds.length === 0) {
			throw new EmptyQuizAttemptError();
		}

		const issues = collectDraftIssues(draft);

		if (issues.length > 0) {
			throw new QuizAttemptValidationError(issues);
		}

		return frozen({
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

	static restore(snapshot: AttemptSnapshot): AttemptEntity {
		if (snapshot.questionIds.length === 0) {
			throw new EmptyQuizAttemptError();
		}

		const issues = collectSnapshotIssues(snapshot);

		if (issues.length > 0) {
			throw new QuizAttemptValidationError(issues);
		}

		return frozen({
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

	static currentQuestionId(attempt: AttemptEntity): QuestionId | undefined {
		return attempt.questionIds[attempt.responses.length];
	}

	static recordResponse(
		attempt: AttemptEntity,
		response: QuestionResponse,
	): AttemptEntity {
		assertStatus(attempt, [QuizAttemptStatus.Active], "answered");
		assertMutationDate(attempt, response.answeredAt, "answeredAt");

		if (
			attempt.responses.some(
				(recorded) => recorded.questionId === response.questionId,
			)
		) {
			throw new DuplicateResponseError();
		}

		if (AttemptEntity.currentQuestionId(attempt) !== response.questionId) {
			throw new QuestionNotInAttemptError();
		}

		const issues = collectResponseIssues(response);

		if (issues.length > 0) {
			throw new QuizAttemptValidationError(issues);
		}

		return frozen({
			...attempt,
			responses: [...attempt.responses, response],
			updatedAt: response.answeredAt,
		});
	}

	static rateResponse(
		attempt: AttemptEntity,
		questionId: QuestionId,
		recall: RecallGrade,
		at: Date,
	): AttemptEntity {
		assertStatus(attempt, [QuizAttemptStatus.Active], "rated");
		assertMutationDate(attempt, at, "at");

		const answered = attempt.responses.find(
			(response) => response.questionId === questionId,
		);

		if (answered === undefined) {
			throw new QuestionNotInAttemptError();
		}

		if (!answered.isCorrect) {
			return attempt;
		}

		return frozen({
			...attempt,
			responses: attempt.responses.map((response) =>
				response.questionId === questionId ? { ...response, recall } : response,
			),
			updatedAt: at,
		});
	}

	static pause(attempt: AttemptEntity, at: Date): AttemptEntity {
		assertStatus(attempt, [QuizAttemptStatus.Active], "paused");
		assertMutationDate(attempt, at, "at");

		return frozen({
			...attempt,
			status: QuizAttemptStatus.Paused,
			updatedAt: at,
		});
	}

	static resume(attempt: AttemptEntity, at: Date): AttemptEntity {
		assertStatus(attempt, [QuizAttemptStatus.Paused], "resumed");
		assertMutationDate(attempt, at, "at");

		return frozen({
			...attempt,
			status: QuizAttemptStatus.Active,
			updatedAt: at,
		});
	}

	static complete(attempt: AttemptEntity, at: Date): AttemptEntity {
		assertStatus(
			attempt,
			[QuizAttemptStatus.Active, QuizAttemptStatus.Paused],
			"completed",
		);
		assertMutationDate(attempt, at, "at");

		return frozen({
			...attempt,
			status: QuizAttemptStatus.Completed,
			completedAt: at,
			updatedAt: at,
		});
	}

	static score(attempt: AttemptEntity): Score {
		return Score.of(attempt.responses, attempt.questionIds.length);
	}
}
