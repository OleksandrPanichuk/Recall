import type { Folder, FolderId } from "@/domain/folder/folder";
import type { QuizSetStatus } from "@/domain/quiz-set/quiz-set";

export interface FolderRepository {
	save(folder: Folder): void;
	findById(id: FolderId): Folder | undefined;
	listChildren(parentId: FolderId | undefined): readonly Folder[];
	listAncestors(id: FolderId): readonly Folder[];
	listAll(): readonly Folder[];
	countSetsIn(id: FolderId, statuses?: readonly QuizSetStatus[]): number;
	delete(id: FolderId): void;
}
