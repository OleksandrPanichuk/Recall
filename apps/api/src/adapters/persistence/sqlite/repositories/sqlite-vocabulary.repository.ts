import { asc, eq } from "drizzle-orm";
import type { VocabularyRepository } from "@/application/ports/repositories/vocabulary.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type {
	VocabularyItem,
	VocabularyItemId,
} from "@/domain/vocabulary/vocabulary-item";
import type { QuizDatabase } from "../database";
import { vocabularyItems } from "../schema";
import { toVocabularyItem, toVocabularyItemRow } from "./vocabulary.mapper";

export function createSqliteVocabularyRepository(
	database: QuizDatabase,
	transaction: Transaction,
): VocabularyRepository {
	return {
		save(item: VocabularyItem): void {
			const row = toVocabularyItemRow(item);

			transaction.run(() => {
				database
					.insert(vocabularyItems)
					.values(row)
					.onConflictDoUpdate({ target: vocabularyItems.id, set: row })
					.run();
			});
		},

		findById(id: VocabularyItemId): VocabularyItem | undefined {
			const row = database
				.select()
				.from(vocabularyItems)
				.where(eq(vocabularyItems.id, id))
				.get();

			return row ? toVocabularyItem(row) : undefined;
		},

		listBySet(quizSetId: QuizSetId): readonly VocabularyItem[] {
			return database
				.select()
				.from(vocabularyItems)
				.where(eq(vocabularyItems.quizSetId, quizSetId))
				.orderBy(asc(vocabularyItems.createdAt), asc(vocabularyItems.id))
				.all()
				.map(toVocabularyItem);
		},
	};
}
