import type { QuizSetSummary } from "@/application/ports/repositories/quiz-set.repository";
import { createQuestion } from "@/domain/quiz-set/create-question";
import {
	isDifficulty,
	isQuestionType,
	type Question,
	type QuestionOption,
	toQuestionId,
	toQuestionOptionId,
} from "@/domain/quiz-set/question";
import { questionFingerprint } from "@/domain/quiz-set/question-fingerprint";
import {
	isQuizSetStatus,
	type QuizSet,
	QuizSetStatus,
	toQuizSetId,
} from "@/domain/quiz-set/quiz-set";

export interface QuizSetRow {
	readonly id: string;
	readonly title: string;
	readonly description: string | null;
	readonly language: string;
	readonly source: string | null;
	readonly source_chapters: string | null;
	readonly tags: string;
	readonly status: string;
	readonly created_at: string;
	readonly updated_at: string;
	readonly published_at: string | null;
	readonly archived_at: string | null;
}

export interface QuestionRow {
	readonly id: string;
	readonly quiz_set_id: string;
	readonly type: string;
	readonly prompt: string;
	readonly explanation: string | null;
	readonly source_reference: string | null;
	readonly topic: string | null;
	readonly difficulty: string;
	readonly hint: string | null;
	readonly position: number;
	readonly fingerprint: string;
}

export interface QuestionOptionRow {
	readonly id: string;
	readonly question_id: string;
	readonly text: string;
	readonly is_correct: number;
	readonly position: number;
}

export interface QuizSetSummaryRow {
	readonly id: string;
	readonly title: string;
	readonly status: string;
	readonly question_count: number;
	readonly updated_at: string;
}

export class CorruptedQuizSetRowError extends Error {
	readonly issues: readonly string[];

	constructor(id: string, issues: readonly string[]) {
		super(
			`Quiz set ${id} cannot be restored from storage:\n${issues
				.map((issue) => `- ${issue}`)
				.join("\n")}`,
		);
		this.name = "CorruptedQuizSetRowError";
		this.issues = issues;
	}
}

const requiredDate = (value: string, column: string, id: string): Date => {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		throw new CorruptedQuizSetRowError(id, [
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

const parseTags = (row: QuizSetRow): string[] => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(row.tags);
	} catch {
		throw new CorruptedQuizSetRowError(row.id, ["tags must be a JSON array"]);
	}

	if (
		!Array.isArray(parsed) ||
		!parsed.every((tag): tag is string => typeof tag === "string")
	) {
		throw new CorruptedQuizSetRowError(row.id, [
			"tags must be a JSON array of strings",
		]);
	}

	return parsed;
};

const toIsCorrect = (value: number, questionId: string): boolean => {
	if (value !== 0 && value !== 1) {
		throw new CorruptedQuizSetRowError(questionId, [
			`is_correct must be 0 or 1, received ${value}`,
		]);
	}

	return value === 1;
};

const toStatus = (value: string, id: string) => {
	if (!isQuizSetStatus(value)) {
		throw new CorruptedQuizSetRowError(id, [
			`status "${value}" is not a supported quiz set status`,
		]);
	}

	return value;
};

function toQuestion(
	row: QuestionRow,
	optionRows: readonly QuestionOptionRow[],
): Question {
	const type = row.type;
	const difficulty = row.difficulty;

	if (!isQuestionType(type)) {
		throw new CorruptedQuizSetRowError(row.quiz_set_id, [
			`question ${row.id} has unsupported type "${type}"`,
		]);
	}

	if (!isDifficulty(difficulty)) {
		throw new CorruptedQuizSetRowError(row.quiz_set_id, [
			`question ${row.id} has unsupported difficulty "${difficulty}"`,
		]);
	}

	const options = optionRows.map(
		(option): QuestionOption => ({
			id: toQuestionOptionId(option.id),
			text: option.text,
			isCorrect: toIsCorrect(option.is_correct, row.id),
			position: option.position,
		}),
	);

	return createQuestion({
		id: toQuestionId(row.id),
		type,
		prompt: row.prompt,
		difficulty,
		position: row.position,
		options,
		explanation: row.explanation ?? undefined,
		sourceReference: row.source_reference ?? undefined,
		topic: row.topic ?? undefined,
		hint: row.hint ?? undefined,
	});
}

const groupOptionsByQuestion = (
	optionRows: readonly QuestionOptionRow[],
): Map<string, QuestionOptionRow[]> => {
	const grouped = new Map<string, QuestionOptionRow[]>();

	for (const option of optionRows) {
		const bucket = grouped.get(option.question_id);

		if (bucket === undefined) {
			grouped.set(option.question_id, [option]);
		} else {
			bucket.push(option);
		}
	}

	return grouped;
};

// The aggregate is assembled from validated parts rather than replayed through
// createQuizSet, which would renumber positions and overwrite updatedAt. These
// checks stand in for the invariants those constructors would otherwise enforce,
// so a hand-edited row fails here instead of surfacing as an impossible
// aggregate inside a presenter.
const assertAggregateInvariants = (
	row: QuizSetRow,
	status: QuizSetStatus,
): void => {
	const issues: string[] = [];

	if (row.title.trim().length === 0) {
		issues.push("title must not be empty");
	}

	if (row.language.trim().length === 0) {
		issues.push("language must not be empty");
	}

	if (status === QuizSetStatus.Published && row.published_at === null) {
		issues.push("a published quiz set must have published_at");
	}

	if (status === QuizSetStatus.Archived && row.archived_at === null) {
		issues.push("an archived quiz set must have archived_at");
	}

	if (issues.length > 0) {
		throw new CorruptedQuizSetRowError(row.id, issues);
	}
};

export function toQuizSet(
	row: QuizSetRow,
	questionRows: readonly QuestionRow[],
	optionRows: readonly QuestionOptionRow[],
): QuizSet {
	const status = toStatus(row.status, row.id);
	const optionsByQuestion = groupOptionsByQuestion(optionRows);

	assertAggregateInvariants(row, status);

	return Object.freeze({
		id: toQuizSetId(row.id),
		title: row.title,
		status,
		language: row.language,
		questions: Object.freeze(
			questionRows.map((question) =>
				toQuestion(question, optionsByQuestion.get(question.id) ?? []),
			),
		),
		tags: Object.freeze(parseTags(row)),
		createdAt: requiredDate(row.created_at, "created_at", row.id),
		updatedAt: requiredDate(row.updated_at, "updated_at", row.id),
		description: row.description ?? undefined,
		source: row.source ?? undefined,
		sourceChapters: row.source_chapters ?? undefined,
		publishedAt: optionalDate(row.published_at, "published_at", row.id),
		archivedAt: optionalDate(row.archived_at, "archived_at", row.id),
	});
}

export function toQuizSetSummary(row: QuizSetSummaryRow): QuizSetSummary {
	return {
		id: toQuizSetId(row.id),
		title: row.title,
		status: toStatus(row.status, row.id),
		questionCount: row.question_count,
		updatedAt: requiredDate(row.updated_at, "updated_at", row.id),
	};
}

export function toQuizSetRow(quizSet: QuizSet): QuizSetRow {
	return {
		id: quizSet.id,
		title: quizSet.title,
		description: quizSet.description ?? null,
		language: quizSet.language,
		source: quizSet.source ?? null,
		source_chapters: quizSet.sourceChapters ?? null,
		tags: JSON.stringify(quizSet.tags),
		status: quizSet.status,
		created_at: quizSet.createdAt.toISOString(),
		updated_at: quizSet.updatedAt.toISOString(),
		published_at: quizSet.publishedAt?.toISOString() ?? null,
		archived_at: quizSet.archivedAt?.toISOString() ?? null,
	};
}

export function toQuestionRow(
	quizSetId: string,
	question: Question,
): QuestionRow {
	return {
		id: question.id,
		quiz_set_id: quizSetId,
		type: question.type,
		prompt: question.prompt,
		explanation: question.explanation ?? null,
		source_reference: question.sourceReference ?? null,
		topic: question.topic ?? null,
		difficulty: question.difficulty,
		hint: question.hint ?? null,
		position: question.position,
		fingerprint: questionFingerprint(question),
	};
}

export function toQuestionOptionRows(
	question: Question,
): readonly QuestionOptionRow[] {
	return question.options.map((option) => ({
		id: option.id,
		question_id: question.id,
		text: option.text,
		is_correct: option.isCorrect ? 1 : 0,
		position: option.position,
	}));
}
