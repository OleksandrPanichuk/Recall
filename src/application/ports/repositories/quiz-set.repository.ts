import type { FolderId } from "@/domain/folder/folder";
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
	// null selects unfiled sets; omitted means every folder
	readonly folderId?: FolderId | null;
}

export interface QuizSetRepository {
	save(quizSet: QuizSet): void;
	findById(id: QuizSetId): QuizSet | undefined;
	list(filter?: QuizSetListFilter): readonly QuizSetSummary[];
}
