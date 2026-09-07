import type { BrandedId } from "@/core/branded-id";

export type QuizSetId = BrandedId<"QuizSetId">;

export interface QuizSetDraft {
	readonly id: QuizSetId;
	readonly title: string;
	readonly language: string;
	readonly createdAt: Date;
	readonly description?: string;
	readonly source?: string;
	readonly sourceChapters?: string;
	readonly tags?: readonly string[];
}

export interface QuizSetMetadata {
	readonly title?: string;
	readonly language?: string;
	readonly description?: string;
	readonly source?: string;
	readonly sourceChapters?: string;
	readonly tags?: readonly string[];
}
