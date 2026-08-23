import type { Folder, FolderId } from "@/domain/folder/folder";
import type { QuizSetStatus } from "@/domain/quiz-set/quiz-set";
import type { AttemptRepository } from "./attempt.repository";
import type { QuizRepository } from "./quiz.repository";

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
	delete(id: FolderId): Promise<void>;
}

export interface RepositoryScope {
	readonly pages: PageRepository;
	readonly quizzes: QuizRepository;
	readonly attempts: AttemptRepository;
}
