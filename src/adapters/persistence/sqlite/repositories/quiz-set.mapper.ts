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
import type { questionOptions, questions, quizSets } from "../schema";

// Row shapes come from the Drizzle schema, so a column rename or a type change
// breaks compilation here instead of at runtime.
export type QuizSetRow = typeof quizSets.$inferSelect;
export type QuestionRow = typeof questions.$inferSelect;
export type QuestionOptionRow = typeof questionOptions.$inferSelect;
export type QuizSetInsert = typeof quizSets.$inferInsert;
export type QuestionInsert = typeof questions.$inferInsert;
export type QuestionOptionInsert = typeof questionOptions.$inferInsert;

export interface QuizSetSummaryRow {
	readonly id: string;
	readonly title: string;
	readonly status: string;
	readonly questionCount: number;
	readonly updatedAt: string;
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
		throw new CorruptedQuizSetRowError(row.quizSetId, [
			`question ${row.id} has unsupported type "${type}"`,
		]);
	}

	if (!isDifficulty(difficulty)) {
		throw new CorruptedQuizSetRowError(row.quizSetId, [
			`question ${row.id} has unsupported difficulty "${difficulty}"`,
		]);
	}

	const options = optionRows.map(
		(option): QuestionOption => ({
			id: toQuestionOptionId(option.id),
			text: option.text,
			isCorrect: option.isCorrect,
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
		sourceReference: row.sourceReference ?? undefined,
		topic: row.topic ?? undefined,
		hint: row.hint ?? undefined,
	});
}

const groupOptionsByQuestion = (
	optionRows: readonly QuestionOptionRow[],
): Map<string, QuestionOptionRow[]> => {
	const grouped = new Map<string, QuestionOptionRow[]>();

	for (const option of optionRows) {
		const bucket = grouped.get(option.questionId);

		if (bucket === undefined) {
			grouped.set(option.questionId, [option]);
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

	if (status === QuizSetStatus.Published && row.publishedAt === null) {
		issues.push("a published quiz set must have published_at");
	}

	if (status === QuizSetStatus.Archived && row.archivedAt === null) {
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
		createdAt: requiredDate(row.createdAt, "created_at", row.id),
		updatedAt: requiredDate(row.updatedAt, "updated_at", row.id),
		description: row.description ?? undefined,
		source: row.source ?? undefined,
		sourceChapters: row.sourceChapters ?? undefined,
		publishedAt: optionalDate(row.publishedAt, "published_at", row.id),
		archivedAt: optionalDate(row.archivedAt, "archived_at", row.id),
	});
}

export function toQuizSetSummary(row: QuizSetSummaryRow): QuizSetSummary {
	return {
		id: toQuizSetId(row.id),
		title: row.title,
		status: toStatus(row.status, row.id),
		questionCount: row.questionCount,
		updatedAt: requiredDate(row.updatedAt, "updated_at", row.id),
	};
}

export function toQuizSetRow(quizSet: QuizSet): QuizSetInsert {
	return {
		id: quizSet.id,
		title: quizSet.title,
		description: quizSet.description ?? null,
		language: quizSet.language,
		source: quizSet.source ?? null,
		sourceChapters: quizSet.sourceChapters ?? null,
		tags: JSON.stringify(quizSet.tags),
		status: quizSet.status,
		createdAt: quizSet.createdAt.toISOString(),
		updatedAt: quizSet.updatedAt.toISOString(),
		publishedAt: quizSet.publishedAt?.toISOString() ?? null,
		archivedAt: quizSet.archivedAt?.toISOString() ?? null,
	};
}

export function toQuestionRow(
	quizSetId: string,
	question: Question,
): QuestionInsert {
	return {
		id: question.id,
		quizSetId,
		type: question.type,
		prompt: question.prompt,
		explanation: question.explanation ?? null,
		sourceReference: question.sourceReference ?? null,
		topic: question.topic ?? null,
		difficulty: question.difficulty,
		hint: question.hint ?? null,
		position: question.position,
		fingerprint: questionFingerprint(question),
	};
}

export function toQuestionOptionRows(
	question: Question,
): readonly QuestionOptionInsert[] {
	return question.options.map((option) => ({
		id: option.id,
		questionId: question.id,
		text: option.text,
		isCorrect: option.isCorrect,
		position: option.position,
	}));
}
