import type { DueSet, FinishQuizAttemptResult } from "@recall/contracts";

export const nextDueAfter = (
	due: readonly DueSet[],
	quizSetId: string,
): DueSet | null => due.find((set) => set.quizSetId !== quizSetId) ?? null;

export const finishedWith = async (
	finish: () => Promise<FinishQuizAttemptResult>,
	listDue: () => Promise<readonly DueSet[]>,
): Promise<{ result: FinishQuizAttemptResult; nextDue: DueSet | null }> => {
	const result = await finish();
	const due = await listDue().catch((): readonly DueSet[] => []);

	return { result, nextDue: nextDueAfter(due, result.quizSetId) };
};
