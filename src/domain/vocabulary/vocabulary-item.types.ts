import type { BrandedId } from "../branded-id";
import type { QuizSetId } from "../quiz-set/quiz-set";
import type { VocabularyDirection } from "./vocabulary-item.constants";

export type VocabularyItemId = BrandedId<"VocabularyItemId">;

export interface VocabularyItem {
	readonly id: VocabularyItemId;
	readonly quizSetId: QuizSetId;
	readonly terms: readonly string[];
	readonly translations: readonly string[];
	readonly transcription?: string;
	readonly example?: string;
	readonly topic?: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

export interface VocabularyItemDraft {
	readonly id: VocabularyItemId;
	readonly quizSetId: QuizSetId;
	readonly terms: readonly string[];
	readonly translations: readonly string[];
	readonly transcription?: string;
	readonly example?: string;
	readonly topic?: string;
	readonly createdAt: Date;
}

export interface VocabularyCard {
	readonly direction: VocabularyDirection;
	readonly prompt: string;
	readonly acceptedAnswers: readonly string[];
	readonly hint?: string;
}
