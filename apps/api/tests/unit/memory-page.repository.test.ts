import { emptyStore } from "@/persistence/memory/store";
import { createMemoryPersistence } from "@/persistence/memory/unit-of-work";
import { describePageRepository } from "../contracts/page.repository.contract";

const store = emptyStore();
const persistence = createMemoryPersistence(store);

describePageRepository("in-memory", () => ({
	unitOfWork: persistence.unitOfWork,
	scope: persistence.scope,
	reset: async () => {
		store.pages.clear();
		store.quizzes.clear();
	},
	seedQuiz: async (pageId, status) => {
		const id = crypto.randomUUID();

		store.quizzes.set(id, { id, pageId, status });
	},
}));
