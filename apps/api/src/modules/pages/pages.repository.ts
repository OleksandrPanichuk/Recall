import type { PageEntity, PageId } from "./page.entity";
import type {
	LinkedQuizFilter,
	LinkedQuizId,
	LinkedQuizStatus,
	LinkedQuizSummary,
} from "./page.quiz-link";

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

export abstract class PagesRepository {
	abstract save(page: PageEntity): Promise<void>;
	abstract findById(id: PageId): Promise<PageEntity | undefined>;
	abstract listChildren(
		parentId: PageId | undefined,
	): Promise<readonly PageEntity[]>;
	abstract listAncestors(id: PageId): Promise<readonly PageEntity[]>;
	abstract listAll(): Promise<readonly PageEntity[]>;
	abstract countQuizzesIn(
		id: PageId,
		statuses?: readonly LinkedQuizStatus[],
	): Promise<number>;
	abstract countChildPages(id: PageId): Promise<number>;
	abstract attachQuiz(id: PageId, quizId: LinkedQuizId): Promise<void>;
	abstract detachQuiz(id: PageId, quizId: LinkedQuizId): Promise<void>;
	abstract listAttachedQuizIds(id: PageId): Promise<readonly LinkedQuizId[]>;
	abstract findLinkedQuiz(
		id: LinkedQuizId,
	): Promise<LinkedQuizSummary | undefined>;
	abstract listPublishedQuizzes(
		filter: LinkedQuizFilter,
	): Promise<readonly LinkedQuizSummary[]>;
	abstract recordRevision(revision: PageRevision): Promise<void>;
	abstract listRevisions(
		id: PageId,
		limit?: number,
	): Promise<readonly PageRevision[]>;
	abstract search(query: string, limit?: number): Promise<readonly PageMatch[]>;
	abstract shareOf(id: PageId): Promise<PageShare | undefined>;
	abstract saveShare(share: PageShare): Promise<void>;
	abstract deleteShare(id: PageId): Promise<void>;
	abstract delete(id: PageId): Promise<void>;
}
