import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type {
	VocabularyItem,
	VocabularyItemId,
} from "@/domain/vocabulary/vocabulary-item";

export interface TermPairRepository {
	save(pair: VocabularyItem): Promise<void>;
	findById(id: VocabularyItemId): Promise<VocabularyItem | undefined>;
	listForQuiz(quizId: QuizSetId): Promise<readonly VocabularyItem[]>;
}
