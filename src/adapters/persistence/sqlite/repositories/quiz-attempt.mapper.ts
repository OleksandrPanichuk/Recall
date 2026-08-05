import type {
	AttemptStatistics,
	TopicAccuracy,
} from "@/application/ports/repositories/quiz-attempt.repository";
import {
	isQuizAttemptMode,
	isQuizAttemptStatus,
	type QuestionResponse,
	type QuizAttempt,
	restoreQuizAttempt,
	toQuizAttemptId,
} from "@/domain/quiz-attempt/quiz-attempt";
import {
	type QuestionId,
	toQuestionId,
	toQuestionOptionId,
} from "@/domain/quiz-set/question";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";

export interface QuizAttemptRow {
	readonly id: string;
	readonly quiz_set_id: string;
	readonly telegram_user_id: number;
	readonly mode: string;
	readonly status: string;
	readonly question_ids: string;
	readonly started_at: string;
	readonly updated_at: string;
	readonly completed_at: string | null;
}

export interface QuestionResponseRow {
	readonly attempt_id: string;
	readonly question_id: string;
	readonly selected_option_ids: string;
	readonly is_correct: number;
	readonly answered_at: string;
}

export interface AttemptStatisticsRow {
	readonly attempt_id: string;
	readonly quiz_set_id: string;
	readonly correct: number;
	readonly total: number;
	readonly completed_at: string | null;
}

export interface TopicAccuracyRow {
	readonly topic: string | null;
	readonly answered: number;
	readonly correct: number;
}

export class CorruptedQuizAttemptRowError extends Error {
	readonly issues: readonly string[];

	constructor(id: string, issues: readonly string[]) {
		super(
			`Quiz attempt ${id} cannot be restored from storage:\n${issues
				.map((issue) => `- ${issue}`)
				.join("\n")}`,
		);
		this.name = "CorruptedQuizAttemptRowError";
		this.issues = issues;
	}
}

const requiredDate = (value: string, column: string, id: string): Date => {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		throw new CorruptedQuizAttemptRowError(id, [
			`${column} must be a valid ISO timestamp`,
		]);
	}

	return date;
};

const optionalDate = (
	value: string | null,
	column: string,
	id: string,
): Date | undefined =>
	value === null ? undefined : requiredDate(value, column, id);

const parseStringArray = (value: string, column: string, id: string) => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(value);
	} catch {
		throw new CorruptedQuizAttemptRowError(id, [
			`${column} must be a JSON array`,
		]);
	}

	if (
		!Array.isArray(parsed) ||
		!parsed.every((entry): entry is string => typeof entry === "string")
	) {
		throw new CorruptedQuizAttemptRowError(id, [
			`${column} must be a JSON array of strings`,
		]);
	}

	return parsed;
};

const toIsCorrect = (value: number, id: string): boolean => {
	if (value !== 0 && value !== 1) {
		throw new CorruptedQuizAttemptRowError(id, [
			`is_correct must be 0 or 1, received ${value}`,
		]);
	}

	return value === 1;
};

const toResponse = (
	row: QuestionResponseRow,
	attemptId: string,
): QuestionResponse => ({
	questionId: toQuestionId(row.question_id),
	selectedOptionIds: parseStringArray(
		row.selected_option_ids,
		"selected_option_ids",
		attemptId,
	).map(toQuestionOptionId),
	isCorrect: toIsCorrect(row.is_correct, attemptId),
	answeredAt: requiredDate(row.answered_at, "answered_at", attemptId),
});

/**
 * Responses are ordered by the plan rather than by their stored timestamps, then
 * handed to `restoreQuizAttempt`, which rejects a row set whose timestamps
 * disagree with that order instead of silently accepting the reordering.
 */
const orderedResponses = (
	row: QuizAttemptRow,
	questionIds: readonly QuestionId[],
	responseRows: readonly QuestionResponseRow[],
): readonly QuestionResponse[] => {
	const remaining = new Map(
		responseRows.map((response) => [response.question_id, response]),
	);
	const responses: QuestionResponse[] = [];

	for (const questionId of questionIds) {
		const responseRow = remaining.get(questionId);

		if (responseRow === undefined) {
			break;
		}

		responses.push(toResponse(responseRow, row.id));
		remaining.delete(questionId);
	}

	if (remaining.size > 0) {
		throw new CorruptedQuizAttemptRowError(row.id, [
			"responses leave a gap in the plan or reference questions outside it",
		]);
	}

	return responses;
};

export function toQuizAttempt(
	row: QuizAttemptRow,
	responseRows: readonly QuestionResponseRow[],
): QuizAttempt {
	const mode = row.mode;
	const status = row.status;

	if (!isQuizAttemptMode(mode)) {
		throw new CorruptedQuizAttemptRowError(row.id, [
			`mode "${mode}" is not a supported quiz attempt mode`,
		]);
	}

	if (!isQuizAttemptStatus(status)) {
		throw new CorruptedQuizAttemptRowError(row.id, [
			`status "${status}" is not a supported quiz attempt status`,
		]);
	}

	const questionIds = parseStringArray(
		row.question_ids,
		"question_ids",
		row.id,
	).map(toQuestionId);

	return restoreQuizAttempt({
		id: toQuizAttemptId(row.id),
		quizSetId: toQuizSetId(row.quiz_set_id),
		telegramUserId: row.telegram_user_id,
		mode,
		status,
		questionIds,
		responses: orderedResponses(row, questionIds, responseRows),
		startedAt: requiredDate(row.started_at, "started_at", row.id),
		updatedAt: requiredDate(row.updated_at, "updated_at", row.id),
		completedAt: optionalDate(row.completed_at, "completed_at", row.id),
	});
}

export function toAttemptStatistics(
	row: AttemptStatisticsRow,
): AttemptStatistics {
	return {
		attemptId: toQuizAttemptId(row.attempt_id),
		quizSetId: toQuizSetId(row.quiz_set_id),
		correct: row.correct,
		total: row.total,
		completedAt: optionalDate(row.completed_at, "completed_at", row.attempt_id),
	};
}

export function toTopicAccuracy(row: TopicAccuracyRow): TopicAccuracy {
	return {
		topic: row.topic ?? undefined,
		answered: row.answered,
		correct: row.correct,
	};
}

export function toQuizAttemptRow(attempt: QuizAttempt): QuizAttemptRow {
	return {
		id: attempt.id,
		quiz_set_id: attempt.quizSetId,
		telegram_user_id: attempt.telegramUserId,
		mode: attempt.mode,
		status: attempt.status,
		question_ids: JSON.stringify(attempt.questionIds),
		started_at: attempt.startedAt.toISOString(),
		updated_at: attempt.updatedAt.toISOString(),
		completed_at: attempt.completedAt?.toISOString() ?? null,
	};
}

export function toQuestionResponseRows(
	attempt: QuizAttempt,
): readonly QuestionResponseRow[] {
	return attempt.responses.map((response) => ({
		attempt_id: attempt.id,
		question_id: response.questionId,
		selected_option_ids: JSON.stringify(response.selectedOptionIds),
		is_correct: response.isCorrect ? 1 : 0,
		answered_at: response.answeredAt.toISOString(),
	}));
}
