import type {
	VocabularyItem,
	VocabularyItemId,
} from "@/domain/vocabulary/vocabulary-item";
import { type QuizSetId } from "@/modules/quizzes";

export interface TermPairRepository {
	save(pair: VocabularyItem): Promise<void>;
	findById(id: VocabularyItemId): Promise<VocabularyItem | undefined>;
	listForQuiz(quizId: QuizSetId): Promise<readonly VocabularyItem[]>;
}
