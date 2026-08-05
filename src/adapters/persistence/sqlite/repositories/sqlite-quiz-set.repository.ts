import type { Database } from "bun:sqlite";
import type {
	QuizSetListFilter,
	QuizSetRepository,
	QuizSetSummary,
} from "@/application/ports/repositories/quiz-set.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { QuizSet, QuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	type QuestionOptionRow,
	type QuestionRow,
	type QuizSetRow,
	type QuizSetSummaryRow,
	toQuestionOptionRows,
	toQuestionRow,
	toQuizSet,
	toQuizSetRow,
	toQuizSetSummary,
} from "./quiz-set.mapper";

const upsertQuizSetSql = `
	INSERT INTO quiz_sets (
		id, title, description, language, source, source_chapters,
		tags, status, created_at, updated_at, published_at, archived_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		title = excluded.title,
		description = excluded.description,
		language = excluded.language,
		source = excluded.source,
		source_chapters = excluded.source_chapters,
		tags = excluded.tags,
		status = excluded.status,
		created_at = excluded.created_at,
		updated_at = excluded.updated_at,
		published_at = excluded.published_at,
		archived_at = excluded.archived_at`;

const upsertQuestionSql = `
	INSERT INTO questions (
		id, quiz_set_id, type, prompt, explanation, source_reference,
		topic, difficulty, hint, position, fingerprint
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		quiz_set_id = excluded.quiz_set_id,
		type = excluded.type,
		prompt = excluded.prompt,
		explanation = excluded.explanation,
		source_reference = excluded.source_reference,
		topic = excluded.topic,
		difficulty = excluded.difficulty,
		hint = excluded.hint,
		position = excluded.position,
		fingerprint = excluded.fingerprint`;

// Questions are upserted rather than deleted and reinserted so that saving a set
// again never cascades away the attempt responses and review items that point at
// the surviving questions. The trade-off is that editing a stored question keeps
// the responses recorded against its previous wording; losing them to a cascade
// is the worse of the two, and published questions are immutable anyway.
const deleteRemovedQuestionsSql = `
	DELETE FROM questions
	WHERE quiz_set_id = ?
		AND id NOT IN (SELECT value FROM json_each(?))`;

// Position and fingerprint are unique per set and SQLite checks both per
// statement, so upserting in aggregate order would collide whenever a question
// takes a value another surviving question still holds — inserting into the
// middle of a set, or reordering two questions. Parking every survivor outside
// the unique space first keeps any permutation writable. Positions carry no sign
// check, and the prefixed fingerprint cannot collide with a real hash.
const parkQuestionsSql = `
	UPDATE questions
	SET position = -1 - position, fingerprint = 'parked:' || id
	WHERE quiz_set_id = ?`;

const deleteOptionsSql = `
	DELETE FROM question_options
	WHERE question_id IN (SELECT id FROM questions WHERE quiz_set_id = ?)`;

const insertOptionSql = `
	INSERT INTO question_options (id, question_id, text, is_correct, position)
	VALUES (?, ?, ?, ?, ?)`;

const summaryColumnsSql = `
	SELECT
		quiz_sets.id AS id,
		quiz_sets.title AS title,
		quiz_sets.status AS status,
		quiz_sets.updated_at AS updated_at,
		(
			SELECT count(*) FROM questions
			WHERE questions.quiz_set_id = quiz_sets.id
		) AS question_count
	FROM quiz_sets`;

const orderSummariesSql =
	" ORDER BY quiz_sets.updated_at DESC, quiz_sets.id ASC";

export function createSqliteQuizSetRepository(
	database: Database,
	transaction: Transaction,
): QuizSetRepository {
	const upsertQuizSet = database.query(upsertQuizSetSql);
	const upsertQuestion = database.query(upsertQuestionSql);
	const deleteRemovedQuestions = database.query(deleteRemovedQuestionsSql);
	const parkQuestions = database.query(parkQuestionsSql);
	const deleteOptions = database.query(deleteOptionsSql);
	const insertOption = database.query(insertOptionSql);
	const selectQuizSet = database.query<QuizSetRow, [string]>(
		"SELECT * FROM quiz_sets WHERE id = ?",
	);
	const selectQuestions = database.query<QuestionRow, [string]>(
		"SELECT * FROM questions WHERE quiz_set_id = ? ORDER BY position ASC",
	);
	const selectOptions = database.query<QuestionOptionRow, [string]>(
		`SELECT question_options.* FROM question_options
		JOIN questions ON questions.id = question_options.question_id
		WHERE questions.quiz_set_id = ?
		ORDER BY question_options.position ASC`,
	);
	const selectSummaries = database.query<QuizSetSummaryRow, []>(
		summaryColumnsSql + orderSummariesSql,
	);
	const selectSummariesByStatus = database.query<QuizSetSummaryRow, [string]>(
		`${summaryColumnsSql} WHERE quiz_sets.status IN (SELECT value FROM json_each(?))${orderSummariesSql}`,
	);

	const writeQuizSet = (row: QuizSetRow): void => {
		upsertQuizSet.run(
			row.id,
			row.title,
			row.description,
			row.language,
			row.source,
			row.source_chapters,
			row.tags,
			row.status,
			row.created_at,
			row.updated_at,
			row.published_at,
			row.archived_at,
		);
	};

	const writeQuestion = (row: QuestionRow): void => {
		upsertQuestion.run(
			row.id,
			row.quiz_set_id,
			row.type,
			row.prompt,
			row.explanation,
			row.source_reference,
			row.topic,
			row.difficulty,
			row.hint,
			row.position,
			row.fingerprint,
		);
	};

	const writeOption = (row: QuestionOptionRow): void => {
		insertOption.run(
			row.id,
			row.question_id,
			row.text,
			row.is_correct,
			row.position,
		);
	};

	return {
		save(quizSet: QuizSet): void {
			transaction.run(() => {
				writeQuizSet(toQuizSetRow(quizSet));
				deleteOptions.run(quizSet.id);
				deleteRemovedQuestions.run(
					quizSet.id,
					JSON.stringify(quizSet.questions.map((question) => question.id)),
				);
				parkQuestions.run(quizSet.id);

				for (const question of quizSet.questions) {
					writeQuestion(toQuestionRow(quizSet.id, question));

					for (const option of toQuestionOptionRows(question)) {
						writeOption(option);
					}
				}
			});
		},

		findById(id: QuizSetId): QuizSet | undefined {
			const row = selectQuizSet.get(id);

			if (!row) {
				return undefined;
			}

			return toQuizSet(row, selectQuestions.all(id), selectOptions.all(id));
		},

		list(filter?: QuizSetListFilter): readonly QuizSetSummary[] {
			const rows =
				filter?.statuses === undefined
					? selectSummaries.all()
					: selectSummariesByStatus.all(JSON.stringify(filter.statuses));

			return rows.map(toQuizSetSummary);
		},
	};
}
