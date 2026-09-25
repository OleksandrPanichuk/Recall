import { emptyStore } from "@tests/fixtures/memory/store";
import { createMemoryPersistence } from "@tests/fixtures/memory/unit-of-work";
import { anAnswer, anAttempt } from "@tests/fixtures/quiz-attempt.fixture";
import { describeQuizRepository } from "../contracts/quiz.repository.contract";

const store = emptyStore();
const persistence = createMemoryPersistence(store);

describeQuizRepository("in-memory", () => ({
	unitOfWork: persistence.unitOfWork,
	scope: persistence.scope,
	reset: async () => {
		store.pages.clear();
		store.quizzes.clear();
		store.quizAggregates.clear();
		store.quizVersions.clear();
		store.answeredQuestionIds.clear();
		store.attempts.clear();
	},
	markAnswered: async (questionId) => {
		const attempt = anAttempt({
			id: crypto.randomUUID(),
			questionIds: [questionId],
		});

		store.answeredQuestionIds.add(questionId);
		store.attempts.set(String(attempt.id), {
			...attempt,
			responses: [anAnswer(questionId, true, new Date())],
		});
	},
}));
