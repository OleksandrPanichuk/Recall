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
	readonly statuses?: readonly QuizSetStatus[];
}

export interface QuizSetRepository {
	save(quizSet: QuizSet): void;
	findById(id: QuizSetId): QuizSet | undefined;
	list(filter?: QuizSetListFilter): readonly QuizSetSummary[];
}
