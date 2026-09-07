import { type BrandedId, brandedId } from "@/core/branded-id";

export type LinkedQuizId = BrandedId<"QuizSetId">;

export const toLinkedQuizId = (value: string): LinkedQuizId =>
	brandedId<"QuizSetId">(value, "QuizSetId");

export type LinkedQuizStatus = "draft" | "published" | "archived";

export const PUBLISHED: readonly LinkedQuizStatus[] = ["published"];
