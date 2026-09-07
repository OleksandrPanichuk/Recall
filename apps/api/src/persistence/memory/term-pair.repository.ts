import type { TermPairRepository } from "@/application/ports/repositories/term-pair.repository";
import { type QuizSetId } from "@/modules/quizzes";
import { TermPairEntity, type VocabularyItemId } from "@/modules/vocabulary";
import type { MemoryStore } from "./store";

export function createMemoryTermPairRepository(
	store: MemoryStore,
): TermPairRepository {
	return {
		async save(pair: TermPairEntity): Promise<void> {
			store.termPairs.set(String(pair.id), pair);
		},

		async findById(id: VocabularyItemId): Promise<TermPairEntity | undefined> {
			return store.termPairs.get(String(id));
		},

		async listForQuiz(quizId: QuizSetId): Promise<readonly TermPairEntity[]> {
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
