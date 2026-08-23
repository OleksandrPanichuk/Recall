import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type {
	VocabularyItem,
	VocabularyItemId,
} from "@/domain/vocabulary/vocabulary-item";

export interface VocabularyRepository {
	save(item: VocabularyItem): void;
	findById(id: VocabularyItemId): VocabularyItem | undefined;
	listBySet(quizSetId: QuizSetId): readonly VocabularyItem[];
}
