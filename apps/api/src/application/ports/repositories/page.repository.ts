import type { QuizSetId, QuizSetStatus } from "@/domain/quiz-set/quiz-set";
import { PageEntity, type PageId } from "@/modules/pages";
import type { AnalyticsRepository } from "./analytics.repository";
import type { AttachmentRepository } from "./attachment.repository";
import type { AttemptRepository } from "./attempt.repository";
import type { QuizRepository } from "./quiz.repository";
import type { ReviewRepository } from "./review.repository";
import type { TermPairRepository } from "./term-pair.repository";

export type RevisionAuthor = "user" | "mcp";

export interface PageRevision {
	readonly id: string;
	readonly pageId: PageId;
	readonly title: string;
	readonly summary?: string;
	readonly authorKind: RevisionAuthor;
	readonly createdAt: Date;
}

export interface PageShare {
	readonly pageId: PageId;
	readonly token: string;
	readonly createdAt: Date;
}

export interface PageMatch {
	readonly id: PageId;
	readonly name: string;
	readonly excerpt?: string;
}

export interface PageRepository {
	save(page: PageEntity): Promise<void>;
	findById(id: PageId): Promise<PageEntity | undefined>;
	listChildren(parentId: PageId | undefined): Promise<readonly PageEntity[]>;
	listAncestors(id: PageId): Promise<readonly PageEntity[]>;
	listAll(): Promise<readonly PageEntity[]>;
	countQuizzesIn(
		id: PageId,
		statuses?: readonly QuizSetStatus[],
	): Promise<number>;
	countChildPages(id: PageId): Promise<number>;
	attachQuiz(id: PageId, quizId: QuizSetId): Promise<void>;
	detachQuiz(id: PageId, quizId: QuizSetId): Promise<void>;
	listAttachedQuizIds(id: PageId): Promise<readonly QuizSetId[]>;
	recordRevision(revision: PageRevision): Promise<void>;
	listRevisions(id: PageId, limit?: number): Promise<readonly PageRevision[]>;
	search(query: string, limit?: number): Promise<readonly PageMatch[]>;
	shareOf(id: PageId): Promise<PageShare | undefined>;
	saveShare(share: PageShare): Promise<void>;
	deleteShare(id: PageId): Promise<void>;
	delete(id: PageId): Promise<void>;
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
