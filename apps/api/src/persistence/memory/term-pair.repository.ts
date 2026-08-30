import type { TermPairRepository } from "@/application/ports/repositories/term-pair.repository";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type {
	VocabularyItem,
	VocabularyItemId,
} from "@/domain/vocabulary/vocabulary-item";
import type { MemoryStore } from "./store";

export function createMemoryTermPairRepository(
	store: MemoryStore,
): TermPairRepository {
	return {
		async save(pair: VocabularyItem): Promise<void> {
			store.termPairs.set(String(pair.id), pair);
		},

		async findById(id: VocabularyItemId): Promise<VocabularyItem | undefined> {
			return store.termPairs.get(String(id));
		},

		async listForQuiz(quizId: QuizSetId): Promise<readonly VocabularyItem[]> {
			return [...store.termPairs.values()]
				.filter((pair) => String(pair.quizSetId) === String(quizId))
				.sort(
					(left, right) =>
						left.createdAt.getTime() - right.createdAt.getTime() ||
						String(left.id).localeCompare(String(right.id)),
				);
		},
	};
}
