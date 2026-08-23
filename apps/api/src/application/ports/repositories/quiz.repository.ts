import type { FolderId } from "@/domain/folder/folder";
import type {
	QuizSet,
	QuizSetId,
	QuizSetStatus,
} from "@/domain/quiz-set/quiz-set";

export interface QuizSummary {
	readonly id: QuizSetId;
	readonly title: string;
	readonly status: QuizSetStatus;
	readonly questionCount: number;
	readonly updatedAt: Date;
}

export interface QuizListFilter {
	readonly statuses?: readonly QuizSetStatus[];
	// null selects quizzes filed nowhere; omitted means every page
	readonly pageId?: FolderId | null;
}

export class QuizVersionConflictError extends Error {
	readonly quizId: QuizSetId;

	constructor(quizId: QuizSetId) {
		super(
			`Quiz ${quizId} changed since it was read; re-read it and apply the change again`,
		);
		this.name = "QuizVersionConflictError";
		this.quizId = quizId;
	}
}

export interface QuizRepository {
	save(quiz: QuizSet, expectedVersion?: number): Promise<number>;
	findById(id: QuizSetId): Promise<QuizSet | undefined>;
	versionOf(id: QuizSetId): Promise<number | undefined>;
	list(filter?: QuizListFilter): Promise<readonly QuizSummary[]>;
}
