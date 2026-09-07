import type { BrandedId } from "@/core/branded-id";
import { type QuizSetId } from "@/modules/quizzes";
import type { VocabularyDirection } from "./term-pair.constants";

export type VocabularyItemId = BrandedId<"VocabularyItemId">;

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
