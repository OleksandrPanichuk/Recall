import {
	type QuestionId,
	type QuizSetId,
	QuizzesRepository,
} from "@/modules/quizzes";

export interface LocatedQuestion {
	readonly questionId: QuestionId;
	readonly quizSetId: QuizSetId;
	readonly quizSetTitle: string;
	readonly prompt: string;
}

export async function locateQuestions(
	quizzes: QuizzesRepository,
	questionIds: readonly QuestionId[],
): Promise<ReadonlyMap<QuestionId, LocatedQuestion>> {
	const located = new Map<QuestionId, LocatedQuestion>();

	if (questionIds.length === 0) {
		return located;
	}

	for (const found of await quizzes.locateQuestions(questionIds)) {
		located.set(found.questionId, {
			questionId: found.questionId,
			quizSetId: found.quizSetId,
			quizSetTitle: found.quizSetTitle,
			prompt: found.prompt,
		});
	}

	return located;
}
