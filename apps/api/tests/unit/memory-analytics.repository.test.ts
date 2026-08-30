import { emptyStore } from "@/persistence/memory/store";
import { createMemoryPersistence } from "@/persistence/memory/unit-of-work";
import { describeAnalyticsRepository } from "../contracts/analytics.repository.contract";

const store = emptyStore();
const persistence = createMemoryPersistence(store);

describeAnalyticsRepository("in-memory", () => ({
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
	},
}));
