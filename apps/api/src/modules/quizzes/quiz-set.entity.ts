import { trimmedOrUndefined } from "@recall/kit";
import { brandedId } from "@/core/branded-id";
import { type PageId } from "@/modules/pages";
import {
	copiedDate,
	copiedOptionalDate,
	isValidDate,
} from "@/shared/utils/date";
import type { QuestionEntity, QuestionId } from "./question.entity";
import { QuizSetStatus } from "./quiz-set.constants";
import type {
	QuizSetDraft,
	QuizSetId,
	QuizSetMetadata,
} from "./quiz-set.entity.types";
import {
	collectDraftIssues,
	collectDuplicateFingerprints,
	collectDuplicateQuestionIds,
} from "./quiz-set.entity.validation";
import { normaliseTags, optionalField, requiredField } from "./quiz-set.fields";
import {
	DuplicateQuestionError,
	DuplicateQuestionIdError,
	EmptyQuizSetError,
	QuizSetTransitionError,
	QuizSetValidationError,
} from "./quizzes.errors";

export { isQuizSetStatus, QuizSetStatus } from "./quiz-set.constants";
export type {
	QuizSetDraft,
	QuizSetId,
	QuizSetMetadata,
} from "./quiz-set.entity.types";

export const toQuizSetId = (value: string): QuizSetId =>
	brandedId<"QuizSetId">(value, "QuizSetId");

const assertTransitionDate = (quizSet: QuizSetEntity, at: Date): void => {
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
	quizSet: QuizSetEntity,
	allowed: readonly QuizSetStatus[],
	action: string,
): void => {
	if (!allowed.includes(quizSet.status)) {
		throw new QuizSetTransitionError(quizSet.status, action);
	}
};

const frozenQuestion = (question: QuestionEntity): QuestionEntity =>
	Object.freeze({
		...question,
		options: Object.freeze(
			question.options.map((option) => Object.freeze({ ...option })),
		),
	});

const frozenQuizSet = (fields: QuizSetEntity): QuizSetEntity =>
	Object.freeze({
		...fields,
		questions: Object.freeze(fields.questions.map(frozenQuestion)),
		tags: Object.freeze([...fields.tags]),
		createdAt: copiedDate(fields.createdAt),
		updatedAt: copiedDate(fields.updatedAt),
		publishedAt: copiedOptionalDate(fields.publishedAt),
		archivedAt: copiedOptionalDate(fields.archivedAt),
	});

export interface QuizSetEntity {
	readonly id: QuizSetId;
	readonly title: string;
	readonly status: QuizSetStatus;
	readonly language: string;
	readonly questions: readonly QuestionEntity[];
	readonly tags: readonly string[];
	readonly createdAt: Date;
	readonly updatedAt: Date;
	readonly description?: string;
	readonly source?: string;
	readonly sourceChapters?: string;
	readonly publishedAt?: Date;
	readonly archivedAt?: Date;
	readonly folderId?: PageId;
}

export class QuizSetEntity {
	private constructor() {}

	static create(draft: QuizSetDraft): QuizSetEntity {
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

	static addQuestions(
		quizSet: QuizSetEntity,
		questions: readonly QuestionEntity[],
		at: Date,
	): QuizSetEntity {
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
			(question, index): QuestionEntity =>
				Object.freeze({ ...question, position: index }),
		);

		return frozenQuizSet({ ...quizSet, questions: appended, updatedAt: at });
	}

	static replaceQuestions(
		quizSet: QuizSetEntity,
		replacements: readonly QuestionEntity[],
		removedIds: readonly QuestionId[],
		at: Date,
	): QuizSetEntity {
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
				(question, index): QuestionEntity =>
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

	static updateMetadata(
		quizSet: QuizSetEntity,
		metadata: QuizSetMetadata,
		at: Date,
	): QuizSetEntity {
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
				metadata.tags === undefined
					? quizSet.tags
					: normaliseTags(metadata.tags),
			updatedAt: at,
		});
	}

	static moveToPage(
		quizSet: QuizSetEntity,
		folderId: PageId | undefined,
		at: Date,
	): QuizSetEntity {
		assertTransitionDate(quizSet, at);

		return frozenQuizSet({ ...quizSet, folderId, updatedAt: at });
	}

	static publish(quizSet: QuizSetEntity, at: Date): QuizSetEntity {
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

	static archive(quizSet: QuizSetEntity, at: Date): QuizSetEntity {
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
}
