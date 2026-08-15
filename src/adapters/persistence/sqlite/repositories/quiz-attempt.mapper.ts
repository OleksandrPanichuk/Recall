import type { TopicAccuracy } from "@/application/ports/repositories/quiz-attempt.repository";
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
import { CorruptedQuizAttemptRowError } from "./quiz-attempt.mapper.errors";
import type {
	QuestionResponseInsert,
	QuestionResponseRow,
	QuizAttemptInsert,
	QuizAttemptRow,
	TopicAccuracyRow,
} from "./quiz-attempt.mapper.types";
import { createRowValueParsers } from "./utils/row-values";

export { CorruptedQuizAttemptRowError } from "./quiz-attempt.mapper.errors";

const { requiredDate, optionalDate, parseStringArray } = createRowValueParsers(
	(id, issues) => new CorruptedQuizAttemptRowError(id, issues),
);

const toResponse = (
	row: QuestionResponseRow,
	attemptId: string,
): QuestionResponse => ({
	questionId: toQuestionId(row.questionId),
	selectedOptionIds: parseStringArray(
		row.selectedOptionIds,
		"selected_option_ids",
		attemptId,
	).map(toQuestionOptionId),
	isCorrect: row.isCorrect,
	answeredAt: requiredDate(row.answeredAt, "answered_at", attemptId),
});

const orderedResponses = (
	row: QuizAttemptRow,
	questionIds: readonly QuestionId[],
	responseRows: readonly QuestionResponseRow[],
): readonly QuestionResponse[] => {
	const remaining = new Map(
		responseRows.map((response) => [response.questionId, response]),
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

export function plannedQuestionIds(row: QuizAttemptRow): readonly QuestionId[] {
	return parseStringArray(row.questionIds, "question_ids", row.id).map(
		toQuestionId,
	);
}

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

	const questionIds = plannedQuestionIds(row);

	return restoreQuizAttempt({
		id: toQuizAttemptId(row.id),
		quizSetId: toQuizSetId(row.quizSetId),
		telegramUserId: row.telegramUserId,
		mode,
		status,
		questionIds,
		responses: orderedResponses(row, questionIds, responseRows),
		startedAt: requiredDate(row.startedAt, "started_at", row.id),
		updatedAt: requiredDate(row.updatedAt, "updated_at", row.id),
		completedAt: optionalDate(row.completedAt, "completed_at", row.id),
	});
}

export function toTopicAccuracy(row: TopicAccuracyRow): TopicAccuracy {
	return {
		topic: row.topic ?? undefined,
		answered: row.answered,
		correct: row.correct,
	};
}

export function toQuizAttemptRow(attempt: QuizAttempt): QuizAttemptInsert {
	return {
		id: attempt.id,
		quizSetId: attempt.quizSetId,
		telegramUserId: attempt.telegramUserId,
		mode: attempt.mode,
		status: attempt.status,
		questionIds: JSON.stringify(attempt.questionIds),
		startedAt: attempt.startedAt.toISOString(),
		updatedAt: attempt.updatedAt.toISOString(),
		completedAt: attempt.completedAt?.toISOString() ?? null,
	};
}

export function toQuestionResponseRows(
	attempt: QuizAttempt,
): readonly QuestionResponseInsert[] {
	return attempt.responses.map((response) => ({
		attemptId: attempt.id,
		questionId: response.questionId,
		selectedOptionIds: JSON.stringify(response.selectedOptionIds),
		isCorrect: response.isCorrect,
		answeredAt: response.answeredAt.toISOString(),
	}));
}
