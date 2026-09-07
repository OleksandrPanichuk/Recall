import { isValidDate } from "@/shared/utils/date";
import type { QuestionEntity, QuestionId } from "./question.entity";
import { questionFingerprint } from "./question-fingerprint";
import type { QuizSetEntity } from "./quiz-set.entity";
import type { QuizSetDraft } from "./quiz-set.entity.types";

export const collectDraftIssues = (
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

export const collectDuplicateQuestionIds = (
	quizSet: QuizSetEntity,
	questions: readonly QuestionEntity[],
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

export const collectDuplicateFingerprints = (
	quizSet: QuizSetEntity,
	questions: readonly QuestionEntity[],
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
