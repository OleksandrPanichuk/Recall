import type { Database } from "bun:sqlite";
import type {
	AttemptStatistics,
	QuizAttemptRepository,
	TopicAccuracy,
} from "@/application/ports/repositories/quiz-attempt.repository";
import type { Transaction } from "@/application/ports/transaction";
import type {
	QuizAttempt,
	QuizAttemptId,
} from "@/domain/quiz-attempt/quiz-attempt";
import { QuizAttemptStatus } from "@/domain/quiz-attempt/quiz-attempt";
import { type QuestionId, toQuestionId } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	type AttemptStatisticsRow,
	type QuestionResponseRow,
	type QuizAttemptRow,
	type TopicAccuracyRow,
	toAttemptStatistics,
	toQuestionResponseRows,
	toQuizAttempt,
	toQuizAttemptRow,
	toTopicAccuracy,
} from "./quiz-attempt.mapper";

const upsertAttemptSql = `
	INSERT INTO quiz_attempts (
		id, quiz_set_id, telegram_user_id, mode, status,
		question_ids, started_at, updated_at, completed_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		quiz_set_id = excluded.quiz_set_id,
		telegram_user_id = excluded.telegram_user_id,
		mode = excluded.mode,
		status = excluded.status,
		question_ids = excluded.question_ids,
		started_at = excluded.started_at,
		updated_at = excluded.updated_at,
		completed_at = excluded.completed_at`;

// A recorded answer is final: replaying a save must never overwrite it, and the
// composite primary key makes double-scoring impossible at the database level.
const insertResponseSql = `
	INSERT INTO question_responses (
		attempt_id, question_id, selected_option_ids, is_correct, answered_at
	) VALUES (?, ?, ?, ?, ?)
	ON CONFLICT (attempt_id, question_id) DO NOTHING`;

// Responses are append-only, so a plan that no longer contains a question would
// otherwise leave its answer behind: it inflates the score, and it makes the
// attempt unreadable because the restore factory rejects responses outside the
// plan.
const deleteUnplannedResponsesSql = `
	DELETE FROM question_responses
	WHERE attempt_id = ?
		AND question_id NOT IN (SELECT value FROM json_each(?))`;

const unfinishedStatuses = [QuizAttemptStatus.Active, QuizAttemptStatus.Paused];

export function createSqliteQuizAttemptRepository(
	database: Database,
	transaction: Transaction,
): QuizAttemptRepository {
	const upsertAttempt = database.query(upsertAttemptSql);
	const insertResponse = database.query(insertResponseSql);
	const deleteUnplannedResponses = database.query(deleteUnplannedResponsesSql);
	const selectUpdatedAt = database.query<{ updated_at: string }, [string]>(
		"SELECT updated_at FROM quiz_attempts WHERE id = ?",
	);
	const selectAttempt = database.query<QuizAttemptRow, [string]>(
		"SELECT * FROM quiz_attempts WHERE id = ?",
	);
	const selectUnfinished = database.query<QuizAttemptRow, [number, string]>(
		`SELECT * FROM quiz_attempts
		WHERE telegram_user_id = ?
			AND status IN (SELECT value FROM json_each(?))
		ORDER BY updated_at DESC, id ASC
		LIMIT 1`,
	);
	const selectResponses = database.query<QuestionResponseRow, [string]>(
		// Unordered on purpose: the mapper rebuilds the list in plan order.
		"SELECT * FROM question_responses WHERE attempt_id = ?",
	);
	const selectCompleted = database.query<
		AttemptStatisticsRow,
		[number, string, string]
	>(
		`SELECT
			attempts.id AS attempt_id,
			attempts.quiz_set_id AS quiz_set_id,
			(
				SELECT count(*) FROM question_responses
				WHERE question_responses.attempt_id = attempts.id
					AND question_responses.is_correct = 1
					AND question_responses.question_id IN (
						SELECT value FROM json_each(attempts.question_ids)
					)
			) AS correct,
			json_array_length(attempts.question_ids) AS total,
			attempts.completed_at AS completed_at
		FROM quiz_attempts AS attempts
		WHERE attempts.telegram_user_id = ?
			AND attempts.quiz_set_id = ?
			AND attempts.status = ?
		ORDER BY attempts.started_at ASC, attempts.id ASC`,
	);
	const selectTopicAccuracy = database.query<TopicAccuracyRow, [number]>(
		`SELECT
			questions.topic AS topic,
			count(*) AS answered,
			sum(responses.is_correct) AS correct
		FROM question_responses AS responses
		JOIN quiz_attempts AS attempts ON attempts.id = responses.attempt_id
		JOIN questions ON questions.id = responses.question_id
		WHERE attempts.telegram_user_id = ?
		GROUP BY questions.topic
		ORDER BY questions.topic IS NULL ASC, questions.topic ASC`,
	);
	const selectIncorrect = database.query<
		{ question_id: string; latest: string },
		[number]
	>(
		`SELECT
			responses.question_id AS question_id,
			max(responses.answered_at) AS latest
		FROM question_responses AS responses
		JOIN quiz_attempts AS attempts ON attempts.id = responses.attempt_id
		WHERE attempts.telegram_user_id = ?
			AND responses.is_correct = 0
			AND NOT EXISTS (
				SELECT 1 FROM question_responses AS later
				JOIN quiz_attempts AS later_attempt ON later_attempt.id = later.attempt_id
				WHERE later_attempt.telegram_user_id = attempts.telegram_user_id
					AND later.question_id = responses.question_id
					AND later.is_correct = 1
					AND later.answered_at > responses.answered_at
			)
		GROUP BY responses.question_id
		ORDER BY latest DESC, responses.question_id ASC`,
	);

	const writeAttempt = (row: QuizAttemptRow): void => {
		upsertAttempt.run(
			row.id,
			row.quiz_set_id,
			row.telegram_user_id,
			row.mode,
			row.status,
			row.question_ids,
			row.started_at,
			row.updated_at,
			row.completed_at,
		);
	};

	const writeResponse = (row: QuestionResponseRow): void => {
		insertResponse.run(
			row.attempt_id,
			row.question_id,
			row.selected_option_ids,
			row.is_correct,
			row.answered_at,
		);
	};

	const restore = (row: QuizAttemptRow): QuizAttempt =>
		toQuizAttempt(row, selectResponses.all(row.id));

	return {
		save(attempt: QuizAttempt): void {
			transaction.run(() => {
				const row = toQuizAttemptRow(attempt);
				const stored = selectUpdatedAt.get(row.id);

				// A writer holding an older copy of the attempt loses the race. Applying
				// it would rewind updated_at past answers the database already holds —
				// which are append-only and therefore stay — leaving a row the restore
				// factory rejects, so the attempt could never be read again.
				if (stored && stored.updated_at > row.updated_at) {
					return;
				}

				writeAttempt(row);
				deleteUnplannedResponses.run(row.id, row.question_ids);

				for (const response of toQuestionResponseRows(attempt)) {
					writeResponse(response);
				}
			});
		},

		findById(id: QuizAttemptId): QuizAttempt | undefined {
			const row = selectAttempt.get(id);

			return row ? restore(row) : undefined;
		},

		findActiveByUser(telegramUserId: number): QuizAttempt | undefined {
			const row = selectUnfinished.get(
				telegramUserId,
				JSON.stringify(unfinishedStatuses),
			);

			return row ? restore(row) : undefined;
		},

		listCompletedBySet(
			telegramUserId: number,
			quizSetId: QuizSetId,
		): readonly AttemptStatistics[] {
			return selectCompleted
				.all(telegramUserId, quizSetId, QuizAttemptStatus.Completed)
				.map(toAttemptStatistics);
		},

		topicAccuracy(telegramUserId: number): readonly TopicAccuracy[] {
			return selectTopicAccuracy.all(telegramUserId).map(toTopicAccuracy);
		},

		incorrectQuestionIds(telegramUserId: number): readonly QuestionId[] {
			return selectIncorrect
				.all(telegramUserId)
				.map((row) => toQuestionId(row.question_id));
		},
	};
}
