import { toFolderId } from "@/domain/folder/folder";
import { createQuestion } from "@/domain/quiz-set/create-question";
import {
	isDifficulty,
	isQuestionType,
	type Question,
	type QuestionOption,
	toQuestionId,
	toQuestionOptionId,
} from "@/domain/quiz-set/question";
import {
	isQuizSetStatus,
	type QuizSet,
	toQuizSetId,
} from "@/domain/quiz-set/quiz-set";
import type { questionOptions, questions, quizzes } from "../schema";

export type QuizRow = typeof quizzes.$inferSelect;
export type QuestionRow = typeof questions.$inferSelect;
export type OptionRow = typeof questionOptions.$inferSelect;

export class CorruptedQuizRowError extends Error {
	constructor(id: string, issues: readonly string[]) {
		super(`Quiz ${id} cannot be read: ${issues.join("; ")}`);
		this.name = "CorruptedQuizRowError";
	}
}

const optionOf = (row: OptionRow): QuestionOption => ({
	id: toQuestionOptionId(row.id),
	text: row.text,
	isCorrect: row.isCorrect,
	position: row.position,
	matchKey: row.matchKey ?? undefined,
});

export function toQuestion(
	row: QuestionRow,
	optionRows: readonly OptionRow[],
): Question {
	if (!isQuestionType(row.type)) {
		throw new CorruptedQuizRowError(row.quizId, [
			`question ${row.id} has unsupported type "${row.type}"`,
		]);
	}

	if (!isDifficulty(row.difficulty)) {
		throw new CorruptedQuizRowError(row.quizId, [
			`question ${row.id} has unsupported difficulty "${row.difficulty}"`,
		]);
	}

	return createQuestion({
		id: toQuestionId(row.id),
		type: row.type,
		prompt: row.prompt,
		difficulty: row.difficulty,
		position: row.position,
		options: optionRows.map(optionOf),
		explanation: row.explanation ?? undefined,
		sourceReference: row.sourceReference ?? undefined,
		topic: row.topic ?? undefined,
		hint: row.hint ?? undefined,
	});
}

export function toQuiz(
	row: QuizRow,
	questionRows: readonly QuestionRow[],
	optionRows: readonly OptionRow[],
): QuizSet {
	if (!isQuizSetStatus(row.status)) {
		throw new CorruptedQuizRowError(row.id, [
			`status "${row.status}" is not supported`,
		]);
	}

	const grouped = new Map<string, OptionRow[]>();

	for (const option of optionRows) {
		const bucket = grouped.get(option.questionId);

		if (bucket === undefined) {
			grouped.set(option.questionId, [option]);
		} else {
			bucket.push(option);
		}
	}

	return Object.freeze({
		id: toQuizSetId(row.id),
		title: row.title,
		status: row.status,
		language: row.language,
		questions: Object.freeze(
			questionRows.map((question) =>
				toQuestion(question, grouped.get(question.id) ?? []),
			),
		),
		tags: Object.freeze([...row.tags]),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		description: row.description ?? undefined,
		source: row.source ?? undefined,
		sourceChapters: row.sourceChapters ?? undefined,
		publishedAt: row.publishedAt ?? undefined,
		archivedAt: row.archivedAt ?? undefined,
		folderId: row.pageId === null ? undefined : toFolderId(row.pageId),
	}) as QuizSet;
}
