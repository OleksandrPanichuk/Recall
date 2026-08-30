import { emptyStore } from "@/persistence/memory/store";
import { createMemoryPersistence } from "@/persistence/memory/unit-of-work";
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
	},
	markAnswered: async (questionId) => {
		store.answeredQuestionIds.add(questionId);
	},
}));
