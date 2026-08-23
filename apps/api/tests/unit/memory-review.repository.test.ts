import { emptyStore } from "@/persistence/memory/store";
import { createMemoryPersistence } from "@/persistence/memory/unit-of-work";
import { describeReviewRepository } from "../contracts/review.repository.contract";

const store = emptyStore();
const persistence = createMemoryPersistence(store);

describeReviewRepository("in-memory", () => ({
	unitOfWork: persistence.unitOfWork,
	scope: persistence.scope,
	reset: async () => {
		store.pages.clear();
		store.quizzes.clear();
		store.quizAggregates.clear();
		store.quizVersions.clear();
		store.answeredQuestionIds.clear();
		store.attempts.clear();
		store.schedules.clear();
		store.settings.clear();
		store.termPairs.clear();
	},
}));
