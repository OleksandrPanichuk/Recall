import type { BrandedId } from "../branded-id";
import type { FolderId } from "../folder/folder";
import type { Question } from "./question";
import type { QuizSetStatus } from "./quiz-set.constants";

export type QuizSetId = BrandedId<"QuizSetId">;

export interface QuizSet {
	readonly id: QuizSetId;
	readonly title: string;
	readonly status: QuizSetStatus;
	readonly language: string;
	readonly questions: readonly Question[];
	readonly tags: readonly string[];
	readonly createdAt: Date;
	readonly updatedAt: Date;
	readonly description?: string;
	readonly source?: string;
	readonly sourceChapters?: string;
	readonly publishedAt?: Date;
	readonly archivedAt?: Date;
	readonly folderId?: FolderId;
}

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
