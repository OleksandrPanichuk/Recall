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
	const wanted = new Set(questionIds);
	const located = new Map<QuestionId, LocatedQuestion>();

	if (wanted.size === 0) {
		return located;
	}

	for (const summary of await quizzes.list()) {
		const quizSet = await quizzes.findById(summary.id);

		if (quizSet === undefined) {
			continue;
		}

		for (const question of quizSet.questions) {
			if (!wanted.has(question.id)) {
				continue;
			}

			located.set(question.id, {
				questionId: question.id,
				quizSetId: quizSet.id,
				quizSetTitle: quizSet.title,
				prompt: question.prompt,
			});
		}

		if (located.size === wanted.size) {
			break;
		}
	}

	return located;
}
