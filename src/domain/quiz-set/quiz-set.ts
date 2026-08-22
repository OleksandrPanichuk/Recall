import {
	copiedDate,
	copiedOptionalDate,
	isValidDate,
} from "@/shared/utils/date";
import { trimmedOrUndefined } from "@/shared/utils/text";
import { brandedId } from "../branded-id";
import type { FolderId } from "../folder/folder";
import type { Question, QuestionId } from "./question";
import { QuizSetStatus } from "./quiz-set.constants";
import {
	DuplicateQuestionError,
	DuplicateQuestionIdError,
	EmptyQuizSetError,
	QuizSetTransitionError,
	QuizSetValidationError,
} from "./quiz-set.errors";
import { normaliseTags, optionalField, requiredField } from "./quiz-set.fields";
import type {
	QuizSet,
	QuizSetDraft,
	QuizSetId,
	QuizSetMetadata,
} from "./quiz-set.types";
import {
	collectDraftIssues,
	collectDuplicateFingerprints,
	collectDuplicateQuestionIds,
} from "./quiz-set.validation";

export { isQuizSetStatus, QuizSetStatus } from "./quiz-set.constants";
export type {
	QuizSet,
	QuizSetDraft,
	QuizSetId,
	QuizSetMetadata,
} from "./quiz-set.types";

export const toQuizSetId = (value: string): QuizSetId =>
	brandedId<"QuizSetId">(value, "QuizSetId");

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

export function addQuestions(
	quizSet: QuizSet,
	questions: readonly Question[],
	at: Date,
): QuizSet {
	assertStatus(
		quizSet,
		[QuizSetStatus.Draft, QuizSetStatus.Published],
		"modified",
	);
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

export function replaceQuestions(
	quizSet: QuizSet,
	replacements: readonly Question[],
	removedIds: readonly QuestionId[],
	at: Date,
): QuizSet {
	assertStatus(
		quizSet,
		[QuizSetStatus.Draft, QuizSetStatus.Published],
		"modified",
	);
	assertTransitionDate(quizSet, at);

	const byId = new Map(
		replacements.map((question) => [question.id, question] as const),
	);
	const removed = new Set(removedIds);
	const questions = quizSet.questions
		.filter((question) => !removed.has(question.id))
		.map((question) => byId.get(question.id) ?? question)
		.map(
			(question, index): Question =>
				frozenQuestion({ ...question, position: index }),
		);

	if (questions.length === 0) {
		throw new EmptyQuizSetError();
	}

	const duplicates = collectDuplicateFingerprints(
		{ ...quizSet, questions: [] },
		questions,
	);

	if (duplicates.length > 0) {
		throw new DuplicateQuestionError(duplicates);
	}

	return frozenQuizSet({ ...quizSet, questions, updatedAt: at });
}

export function updateQuizSetMetadata(
	quizSet: QuizSet,
	metadata: QuizSetMetadata,
	at: Date,
): QuizSet {
	assertStatus(
		quizSet,
		[QuizSetStatus.Draft, QuizSetStatus.Published],
		"modified",
	);
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
