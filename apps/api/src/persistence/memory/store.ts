import type { Folder, FolderId } from "@/domain/folder/folder";
import type { QuizSetStatus } from "@/domain/quiz-set/quiz-set";

export interface MemoryQuiz {
	readonly id: string;
	readonly pageId: string | undefined;
	readonly status: QuizSetStatus;
}

export interface MemoryStore {
	pages: Map<string, Folder>;
	quizzes: Map<string, MemoryQuiz>;
}

export const emptyStore = (): MemoryStore => ({
	pages: new Map(),
	quizzes: new Map(),
});

export const snapshotOf = (store: MemoryStore): MemoryStore => ({
	pages: new Map(store.pages),
	quizzes: new Map(store.quizzes),
});

export const restoreInto = (
	store: MemoryStore,
	snapshot: MemoryStore,
): void => {
	store.pages = new Map(snapshot.pages);
	store.quizzes = new Map(snapshot.quizzes);
};

export const pageIdsOf = (store: MemoryStore): readonly FolderId[] =>
	[...store.pages.keys()].map((id) => id as FolderId);
