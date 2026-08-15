import { isValidDate } from "@/shared/date";
import type { Question, QuestionId } from "./question";
import { questionFingerprint } from "./question-fingerprint";
import type { QuizSet, QuizSetDraft } from "./quiz-set.types";

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

export const collectDuplicateFingerprints = (
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
