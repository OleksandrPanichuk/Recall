import type { DueSet } from "@recall/contracts";

export const reviewCaption = (due: readonly DueSet[]): string => {
	const questions = due.reduce((total, set) => total + set.dueCount, 0);

	return questions === 0
		? "All caught up"
		: `${questions} due in ${due.length} ${due.length === 1 ? "quiz" : "quizzes"}`;
};
