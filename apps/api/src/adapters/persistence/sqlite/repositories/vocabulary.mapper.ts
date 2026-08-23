import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	restoreVocabularyItem,
	toVocabularyItemId,
	type VocabularyItem,
} from "@/domain/vocabulary/vocabulary-item";
import type { vocabularyItems } from "../schema";
import { createRowValueParsers } from "./utils/row-values";
import { CorruptedVocabularyRowError } from "./vocabulary.mapper.errors";

export type VocabularyItemRow = typeof vocabularyItems.$inferSelect;
export type VocabularyItemInsert = typeof vocabularyItems.$inferInsert;

const { requiredDate, parseStringArray } = createRowValueParsers(
	(id, issues) => new CorruptedVocabularyRowError(id, issues),
);

export function toVocabularyItem(row: VocabularyItemRow): VocabularyItem {
	return restoreVocabularyItem({
		id: toVocabularyItemId(row.id),
		quizSetId: toQuizSetId(row.quizSetId),
		terms: parseStringArray(row.terms, "terms", row.id),
		translations: parseStringArray(row.translations, "translations", row.id),
		transcription: row.transcription ?? undefined,
		example: row.example ?? undefined,
		topic: row.topic ?? undefined,
		createdAt: requiredDate(row.createdAt, "created_at", row.id),
		updatedAt: requiredDate(row.updatedAt, "updated_at", row.id),
	});
}

export function toVocabularyItemRow(
	item: VocabularyItem,
): VocabularyItemInsert {
	return {
		id: item.id,
		quizSetId: item.quizSetId,
		terms: JSON.stringify(item.terms),
		translations: JSON.stringify(item.translations),
		transcription: item.transcription ?? null,
		example: item.example ?? null,
		topic: item.topic ?? null,
		createdAt: item.createdAt.toISOString(),
		updatedAt: item.updatedAt.toISOString(),
	};
}
