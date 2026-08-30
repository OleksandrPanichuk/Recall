import type { Folder, FolderId } from "@/domain/folder/folder";
import type { QuizSetId, QuizSetStatus } from "@/domain/quiz-set/quiz-set";
import type { AnalyticsRepository } from "./analytics.repository";
import type { AttachmentRepository } from "./attachment.repository";
import type { AttemptRepository } from "./attempt.repository";
import type { QuizRepository } from "./quiz.repository";
import type { ReviewRepository } from "./review.repository";
import type { TermPairRepository } from "./term-pair.repository";

export type RevisionAuthor = "user" | "mcp";

export interface PageRevision {
	readonly id: string;
	readonly pageId: FolderId;
	readonly title: string;
	readonly summary?: string;
	readonly authorKind: RevisionAuthor;
	readonly createdAt: Date;
}

export interface PageMatch {
	readonly id: FolderId;
	readonly name: string;
	readonly excerpt?: string;
}

export interface PageRepository {
	save(page: Folder): Promise<void>;
	findById(id: FolderId): Promise<Folder | undefined>;
	listChildren(parentId: FolderId | undefined): Promise<readonly Folder[]>;
	listAncestors(id: FolderId): Promise<readonly Folder[]>;
	listAll(): Promise<readonly Folder[]>;
	countQuizzesIn(
		id: FolderId,
		statuses?: readonly QuizSetStatus[],
	): Promise<number>;
	countChildPages(id: FolderId): Promise<number>;
	attachQuiz(id: FolderId, quizId: QuizSetId): Promise<void>;
	detachQuiz(id: FolderId, quizId: QuizSetId): Promise<void>;
	listAttachedQuizIds(id: FolderId): Promise<readonly QuizSetId[]>;
	recordRevision(revision: PageRevision): Promise<void>;
	listRevisions(id: FolderId, limit?: number): Promise<readonly PageRevision[]>;
	search(query: string, limit?: number): Promise<readonly PageMatch[]>;
	delete(id: FolderId): Promise<void>;
}

export interface RepositoryScope {
	readonly pages: PageRepository;
	readonly quizzes: QuizRepository;
	readonly attempts: AttemptRepository;
	readonly reviews: ReviewRepository;
	readonly termPairs: TermPairRepository;
	readonly analytics: AnalyticsRepository;
	readonly attachments: AttachmentRepository;
}
