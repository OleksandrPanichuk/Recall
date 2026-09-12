import { type BrandedId, brandedId } from "@/core/branded-id";
import type { PageId } from "./page.entity";

export type LinkedQuizId = BrandedId<"QuizSetId">;

export const toLinkedQuizId = (value: string): LinkedQuizId =>
	brandedId<"QuizSetId">(value, "QuizSetId");

export type LinkedQuizStatus = "draft" | "published" | "archived";

export const PUBLISHED: readonly LinkedQuizStatus[] = ["published"];

export interface LinkedQuizSummary {
	readonly id: LinkedQuizId;
	readonly title: string;
	readonly status: LinkedQuizStatus;
	readonly questionCount: number;
	readonly updatedAt: Date;
}

export interface LinkedQuizFilter {
	readonly pageId?: PageId | null;
	readonly ids?: readonly LinkedQuizId[];
}
