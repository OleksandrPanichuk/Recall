import type { DueSet } from "@recall/contracts";

export const reviewCaption = (due: readonly DueSet[]): string => {
	const questions = due.reduce((total, set) => total + set.dueCount, 0);

	return questions === 0
		? "Все повторено"
		: `${questions} питань у ${due.length} набор(ах)`;
};
