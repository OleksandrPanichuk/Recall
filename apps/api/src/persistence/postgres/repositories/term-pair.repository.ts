import { asc, eq } from "drizzle-orm";
import type { TermPairRepository } from "@/application/ports/repositories/term-pair.repository";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	restoreVocabularyItem,
	toVocabularyItemId,
	type VocabularyItem,
	type VocabularyItemId,
} from "@/domain/vocabulary/vocabulary-item";
import { termPairs } from "../schema";
import type { Executor } from "../unit-of-work";

type TermPairRow = typeof termPairs.$inferSelect;

const toPair = (row: TermPairRow): VocabularyItem =>
	restoreVocabularyItem({
		id: toVocabularyItemId(row.id),
		quizSetId: toQuizSetId(row.quizId),
		terms: row.terms,
		translations: row.translations,
		transcription: row.transcription ?? undefined,
		example: row.example ?? undefined,
		topic: row.topic ?? undefined,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});

export function createTermPairPostgresRepository(
	executor: Executor,
): TermPairRepository {
	return {
		async save(pair: VocabularyItem): Promise<void> {
			const row = {
				id: String(pair.id),
				quizId: String(pair.quizSetId),
				terms: [...pair.terms],
				translations: [...pair.translations],
				transcription: pair.transcription ?? null,
				example: pair.example ?? null,
				topic: pair.topic ?? null,
				createdAt: pair.createdAt,
				updatedAt: pair.updatedAt,
			};

			await executor
				.insert(termPairs)
				.values(row)
				.onConflictDoUpdate({ target: termPairs.id, set: row });
		},

		async findById(id: VocabularyItemId): Promise<VocabularyItem | undefined> {
			const [row] = await executor
				.select()
				.from(termPairs)
				.where(eq(termPairs.id, String(id)))
				.limit(1);

			return row === undefined ? undefined : toPair(row);
		},

		async listForQuiz(quizId: QuizSetId): Promise<readonly VocabularyItem[]> {
			const rows = await executor
				.select()
				.from(termPairs)
				.where(eq(termPairs.quizId, String(quizId)))
				.orderBy(asc(termPairs.createdAt), asc(termPairs.id));

			return rows.map(toPair);
		},
	};
}
