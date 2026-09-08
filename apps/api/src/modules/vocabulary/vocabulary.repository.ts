import type { QuizSetId } from "@/modules/quizzes";
import type { TermPairEntity, VocabularyItemId } from "./term-pair.entity";

export abstract class TermPairsRepository {
	abstract save(pair: TermPairEntity): Promise<void>;
	abstract findById(id: VocabularyItemId): Promise<TermPairEntity | undefined>;
	abstract listForQuiz(quizId: QuizSetId): Promise<readonly TermPairEntity[]>;
}
