import { type BrandedId, brandedId } from "../branded-id";
import type { FolderId } from "../folder/folder";
import type { Question, QuestionId } from "./question";
import { questionFingerprint } from "./question-fingerprint";
import {
	DuplicateQuestionError,
	DuplicateQuestionIdError,
	EmptyQuizSetError,
	QuizSetTransitionError,
	QuizSetValidationError,
} from "./quiz-set.errors";

export type QuizSetId = BrandedId<"QuizSetId">;

export const toQuizSetId = (value: string): QuizSetId =>
	brandedId<"QuizSetId">(value, "QuizSetId");

export const QuizSetStatus = {
	Draft: "draft",
	Published: "published",
	Archived: "archived",
} as const;
export type QuizSetStatus = (typeof QuizSetStatus)[keyof typeof QuizSetStatus];

export function isQuizSetStatus(value: unknown): value is QuizSetStatus {
	return (Object.values(QuizSetStatus) as readonly unknown[]).includes(value);
}

export interface QuizSet {
	readonly id: QuizSetId;
	readonly title: string;
	readonly status: QuizSetStatus;
	readonly language: string;
	readonly questions: readonly Question[];
	readonly tags: readonly string[];
	readonly createdAt: Date;
	readonly updatedAt: Date;
	readonly description?: string;
	readonly source?: string;
	readonly sourceChapters?: string;
	readonly publishedAt?: Date;
	readonly archivedAt?: Date;
	readonly folderId?: FolderId;
}

interface QuizSetDraft {
	readonly id: QuizSetId;
	readonly title: string;
	readonly language: string;
	readonly createdAt: Date;
	readonly description?: string;
	readonly source?: string;
	readonly sourceChapters?: string;
	readonly tags?: readonly string[];
}

const trimmedOrUndefined = (value: string | undefined): string | undefined => {
	const trimmed = value?.trim();

	return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
};

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

const copiedDate = (value: Date): Date => new Date(value.getTime());

const copiedOptionalDate = (value: Date | undefined): Date | undefined =>
	value === undefined ? undefined : copiedDate(value);

const normaliseTags = (tags: readonly string[] | undefined): string[] => [
	...new Set(
		(tags ?? [])
			.map((tag) => tag.trim())
			.filter((tag): tag is string => tag.length > 0),
	),
];

const collectDraftIssues = (
	draft: QuizSetDraft,
	title: string,
	language: string,
): readonly string[] => {
	const issues: string[] = [];

	if (title.length === 0) {
		issues.push("title must not be empty");
	}

	if (language.length === 0) {
		issues.push("language must not be empty");
	}

	if (!isValidDate(draft.createdAt)) {
		issues.push("createdAt must be a valid date");
	}

	return issues;
};

const assertTransitionDate = (quizSet: QuizSet, at: Date): void => {
	if (!isValidDate(at)) {
		throw new QuizSetValidationError(["at must be a valid date"]);
	}

	if (at.getTime() < quizSet.createdAt.getTime()) {
		throw new QuizSetValidationError(["at must not precede createdAt"]);
	}

	if (at.getTime() < quizSet.updatedAt.getTime()) {
		throw new QuizSetValidationError(["at must not precede updatedAt"]);
	}
};

const assertStatus = (
	quizSet: QuizSet,
	allowed: readonly QuizSetStatus[],
	action: string,
): void => {
	if (!allowed.includes(quizSet.status)) {
		throw new QuizSetTransitionError(quizSet.status, action);
	}
};

const frozenQuestion = (question: Question): Question =>
	Object.freeze({
		...question,
		options: Object.freeze(
			question.options.map((option) => Object.freeze({ ...option })),
		),
	});

const frozenQuizSet = (fields: QuizSet): QuizSet =>
	Object.freeze({
		...fields,
		questions: Object.freeze(fields.questions.map(frozenQuestion)),
		tags: Object.freeze([...fields.tags]),
		createdAt: copiedDate(fields.createdAt),
		updatedAt: copiedDate(fields.updatedAt),
		publishedAt: copiedOptionalDate(fields.publishedAt),
		archivedAt: copiedOptionalDate(fields.archivedAt),
	});

export function createQuizSet(draft: QuizSetDraft): QuizSet {
	const title = draft.title.trim();
	const language = draft.language.trim();
	const issues = collectDraftIssues(draft, title, language);

	if (issues.length > 0) {
		throw new QuizSetValidationError(issues);
	}

	return frozenQuizSet({
		id: draft.id,
		title,
		status: QuizSetStatus.Draft,
		language,
		questions: [],
		tags: normaliseTags(draft.tags),
		createdAt: draft.createdAt,
		updatedAt: draft.createdAt,
		description: trimmedOrUndefined(draft.description),
		source: trimmedOrUndefined(draft.source),
		sourceChapters: trimmedOrUndefined(draft.sourceChapters),
	});
}

const collectDuplicateQuestionIds = (
	quizSet: QuizSet,
	questions: readonly Question[],
): readonly QuestionId[] => {
	const seen = new Set(quizSet.questions.map((question) => question.id));
	const duplicates = new Set<QuestionId>();

	for (const question of questions) {
		if (seen.has(question.id)) {
			duplicates.add(question.id);
		}

		seen.add(question.id);
	}

	return [...duplicates];
};

const collectDuplicateFingerprints = (
	quizSet: QuizSet,
	questions: readonly Question[],
): readonly string[] => {
	const seen = new Set(quizSet.questions.map(questionFingerprint));
	const duplicates = new Set<string>();

	for (const question of questions) {
		const fingerprint = questionFingerprint(question);

		if (seen.has(fingerprint)) {
			duplicates.add(fingerprint);
		}

		seen.add(fingerprint);
	}

	return [...duplicates];
};

export function addQuestions(
	quizSet: QuizSet,
	questions: readonly Question[],
	at: Date,
): QuizSet {
	assertStatus(quizSet, [QuizSetStatus.Draft], "modified");
	assertTransitionDate(quizSet, at);

	if (questions.length === 0) {
		return frozenQuizSet(quizSet);
	}

	const duplicateIds = collectDuplicateQuestionIds(quizSet, questions);

	if (duplicateIds.length > 0) {
		throw new DuplicateQuestionIdError(duplicateIds);
	}

	const duplicates = collectDuplicateFingerprints(quizSet, questions);

	if (duplicates.length > 0) {
		throw new DuplicateQuestionError(duplicates);
	}

	const appended = [...quizSet.questions, ...questions].map(
		(question, index): Question =>
			Object.freeze({ ...question, position: index }),
	);

	return frozenQuizSet({ ...quizSet, questions: appended, updatedAt: at });
}

export interface QuizSetMetadata {
	readonly title?: string;
	readonly language?: string;
	readonly description?: string;
	readonly source?: string;
	readonly sourceChapters?: string;
	readonly tags?: readonly string[];
}

const requiredField = (
	value: string | undefined,
	current: string,
	label: string,
	issues: string[],
): string => {
	if (value === undefined) {
		return current;
	}

	const trimmed = value.trim();

	if (trimmed.length === 0) {
		issues.push(`${label} must not be empty`);

		return current;
	}

	return trimmed;
};

const optionalField = (
	value: string | undefined,
	current: string | undefined,
): string | undefined =>
	value === undefined ? current : trimmedOrUndefined(value);

export function updateQuizSetMetadata(
	quizSet: QuizSet,
	metadata: QuizSetMetadata,
	at: Date,
): QuizSet {
	assertStatus(quizSet, [QuizSetStatus.Draft], "modified");
	assertTransitionDate(quizSet, at);

	const issues: string[] = [];
	const title = requiredField(metadata.title, quizSet.title, "title", issues);
	const language = requiredField(
		metadata.language,
		quizSet.language,
		"language",
		issues,
	);

	if (issues.length > 0) {
		throw new QuizSetValidationError(issues);
	}

	return frozenQuizSet({
		...quizSet,
		title,
		language,
		description: optionalField(metadata.description, quizSet.description),
		source: optionalField(metadata.source, quizSet.source),
		sourceChapters: optionalField(
			metadata.sourceChapters,
			quizSet.sourceChapters,
		),
		tags:
			metadata.tags === undefined ? quizSet.tags : normaliseTags(metadata.tags),
		updatedAt: at,
	});
}

export function moveQuizSetToFolder(
	quizSet: QuizSet,
	folderId: FolderId | undefined,
	at: Date,
): QuizSet {
	assertTransitionDate(quizSet, at);

	return frozenQuizSet({ ...quizSet, folderId, updatedAt: at });
}

export function publishQuizSet(quizSet: QuizSet, at: Date): QuizSet {
	assertStatus(quizSet, [QuizSetStatus.Draft], "published");
	assertTransitionDate(quizSet, at);

	if (quizSet.questions.length === 0) {
		throw new EmptyQuizSetError();
	}

	return frozenQuizSet({
		...quizSet,
		status: QuizSetStatus.Published,
		publishedAt: at,
		updatedAt: at,
	});
}

export function archiveQuizSet(quizSet: QuizSet, at: Date): QuizSet {
	assertStatus(
		quizSet,
		[QuizSetStatus.Draft, QuizSetStatus.Published],
		"archived",
	);
	assertTransitionDate(quizSet, at);

	return frozenQuizSet({
		...quizSet,
		status: QuizSetStatus.Archived,
		archivedAt: at,
		updatedAt: at,
	});
}
