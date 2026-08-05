import type {
	QuizSet,
	QuizSetId,
	QuizSetStatus,
} from "@/domain/quiz-set/quiz-set";

export interface QuizSetSummary {
	readonly id: QuizSetId;
	readonly title: string;
	readonly status: QuizSetStatus;
	readonly questionCount: number;
	readonly updatedAt: Date;
}

export interface QuizSetListFilter {
	/**
	 * Omit to list every set, archived ones included. An empty array is a filter
	 * that matches nothing, not an absent filter.
	 */
	readonly statuses?: readonly QuizSetStatus[];
}

export interface QuizSetRepository {
	/** Inserts or replaces the whole aggregate, questions and options included. */
	save(quizSet: QuizSet): void;
	findById(id: QuizSetId): QuizSet | undefined;
	list(filter?: QuizSetListFilter): readonly QuizSetSummary[];
}
