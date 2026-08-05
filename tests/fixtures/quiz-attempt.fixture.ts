import {
	type QuestionResponse,
	type QuizAttempt,
	QuizAttemptMode,
	startQuizAttempt,
	toQuizAttemptId,
} from "@/domain/quiz-attempt/quiz-attempt";
import {
	type QuestionOptionId,
	toQuestionId,
	toQuestionOptionId,
} from "@/domain/quiz-set/question";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";

interface AttemptOverrides {
	readonly id?: string;
	readonly quizSetId?: string;
	readonly telegramUserId?: number;
	readonly mode?: QuizAttemptMode;
	readonly questionIds?: readonly string[];
	readonly startedAt?: Date;
}

export function anAttempt(overrides: AttemptOverrides = {}): QuizAttempt {
	return startQuizAttempt({
		id: toQuizAttemptId(overrides.id ?? "attempt-1"),
		quizSetId: toQuizSetId(overrides.quizSetId ?? "set-1"),
		telegramUserId: overrides.telegramUserId ?? 42,
		mode: overrides.mode ?? QuizAttemptMode.Full,
		questionIds: (overrides.questionIds ?? ["question-1", "question-2"]).map(
			toQuestionId,
		),
		startedAt: overrides.startedAt ?? new Date("2026-08-01T10:00:00.000Z"),
	});
}

export function anAnswer(
	questionId: string,
	isCorrect: boolean,
	answeredAt: Date,
	selectedOptionIds?: readonly QuestionOptionId[],
): QuestionResponse {
	return {
		questionId: toQuestionId(questionId),
		selectedOptionIds: selectedOptionIds ?? [
			toQuestionOptionId(`${questionId}-a`),
		],
		isCorrect,
		answeredAt,
	};
}

export const questionIdsOf = (attempt: QuizAttempt): readonly string[] =>
	attempt.questionIds.map((id): string => id);

export const answeredQuestionIdsOf = (
	attempt: QuizAttempt,
): readonly string[] =>
	attempt.responses.map((response): string => response.questionId);
