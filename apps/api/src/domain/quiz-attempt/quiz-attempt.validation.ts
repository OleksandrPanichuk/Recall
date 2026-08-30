import { isValidDate } from "@/shared/utils/date";
import { hasDuplicates } from "@/shared/utils/duplicates";
import {
	isQuizAttemptMode,
	isQuizAttemptStatus,
	QuizAttemptStatus,
} from "./quiz-attempt.constants";
import type {
	QuestionResponse,
	QuizAttemptDraft,
	QuizAttemptSnapshot,
} from "./quiz-attempt.types";

export const collectDraftIssues = (
	draft: QuizAttemptDraft,
): readonly string[] => {
	const issues: string[] = [];

	if (
		draft.telegramUserId !== undefined &&
		(!Number.isSafeInteger(draft.telegramUserId) || draft.telegramUserId <= 0)
	) {
		issues.push("telegramUserId must be a positive integer when it is given");
	}

	if (hasDuplicates(draft.questionIds)) {
		issues.push("questionIds must not contain duplicates");
	}

	if (!isValidDate(draft.startedAt)) {
		issues.push("startedAt must be a valid date");
	}

	return issues;
};

export const collectResponseIssues = (
	response: QuestionResponse,
): readonly string[] => {
	const issues: string[] = [];

	const typed = response.typedAnswer?.trim() ?? "";

	if (
		response.selectedOptionIds.length === 0 &&
		typed.length === 0 &&
		response.skipped !== true
	) {
		issues.push("a response must carry selected options or a typed answer");
	}

	if (response.skipped === true && response.isCorrect) {
		issues.push("a skipped response cannot be correct");
	}

	if (hasDuplicates(response.selectedOptionIds)) {
		issues.push("selectedOptionIds must not contain duplicates");
	}

	return issues;
};

const collectTimelineIssues = (
	snapshot: QuizAttemptSnapshot,
): readonly string[] => {
	const issues: string[] = [];
	let previous = snapshot.startedAt;

	for (const [index, response] of snapshot.responses.entries()) {
		if (!isValidDate(response.answeredAt)) {
			issues.push("answeredAt must be a valid date");
			continue;
		}

		if (response.answeredAt.getTime() < previous.getTime()) {
			issues.push(
				index === 0
					? "answeredAt must not precede startedAt"
					: "answeredAt must not precede the previous response",
			);
		}

		previous = response.answeredAt;
	}

	if (snapshot.updatedAt.getTime() < snapshot.startedAt.getTime()) {
		issues.push("updatedAt must not precede startedAt");
	}

	const lastAnsweredAt = snapshot.responses.at(-1)?.answeredAt;

	if (
		lastAnsweredAt !== undefined &&
		isValidDate(lastAnsweredAt) &&
		snapshot.updatedAt.getTime() < lastAnsweredAt.getTime()
	) {
		issues.push("updatedAt must not precede the last response");
	}

	return issues;
};

const collectCompletionIssues = (
	snapshot: QuizAttemptSnapshot,
): readonly string[] => {
	if (snapshot.status !== QuizAttemptStatus.Completed) {
		return snapshot.completedAt === undefined
			? []
			: ["only a completed attempt may have completedAt"];
	}

	if (snapshot.completedAt === undefined) {
		return ["a completed attempt must have completedAt"];
	}

	if (!isValidDate(snapshot.completedAt)) {
		return ["completedAt must be a valid date"];
	}

	return snapshot.completedAt.getTime() === snapshot.updatedAt.getTime()
		? []
		: ["completedAt must equal updatedAt"];
};

export const collectSnapshotIssues = (
	snapshot: QuizAttemptSnapshot,
): readonly string[] => {
	const issues: string[] = [];

	if (!isQuizAttemptStatus(snapshot.status)) {
		issues.push("status must be a supported quiz attempt status");
	}

	if (!isQuizAttemptMode(snapshot.mode)) {
		issues.push("mode must be a supported quiz attempt mode");
	}

	if (
		snapshot.telegramUserId !== undefined &&
		(!Number.isSafeInteger(snapshot.telegramUserId) ||
			snapshot.telegramUserId <= 0)
	) {
		issues.push("telegramUserId must be a positive integer when it is given");
	}

	if (hasDuplicates(snapshot.questionIds)) {
		issues.push("questionIds must not contain duplicates");
	}

	if (!isValidDate(snapshot.startedAt)) {
		issues.push("startedAt must be a valid date");
	}

	if (!isValidDate(snapshot.updatedAt)) {
		issues.push("updatedAt must be a valid date");
	}

	if (snapshot.responses.length > snapshot.questionIds.length) {
		issues.push("responses must not outnumber the planned questions");
	}

	if (
		snapshot.responses.some(
			(response, index) => response.questionId !== snapshot.questionIds[index],
		)
	) {
		issues.push("responses must follow the planned question order");
	}

	for (const response of snapshot.responses) {
		issues.push(...collectResponseIssues(response));
	}

	issues.push(...collectTimelineIssues(snapshot));
	issues.push(...collectCompletionIssues(snapshot));

	return issues;
};
