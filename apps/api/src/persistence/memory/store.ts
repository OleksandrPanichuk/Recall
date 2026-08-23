import type { Folder, FolderId } from "@/domain/folder/folder";
import type { QuizSet, QuizSetStatus } from "@/domain/quiz-set/quiz-set";

export interface MemoryQuiz {
	readonly id: string;
	readonly pageId: string | undefined;
	readonly status: QuizSetStatus;
}

export interface MemoryStore {
	pages: Map<string, Folder>;
	quizzes: Map<string, MemoryQuiz>;
	quizAggregates: Map<string, QuizSet>;
	quizVersions: Map<string, number>;
	answeredQuestionIds: Set<string>;
}

export const emptyStore = (): MemoryStore => ({
	pages: new Map(),
	quizzes: new Map(),
	quizAggregates: new Map(),
	quizVersions: new Map(),
	answeredQuestionIds: new Set(),
});

export const snapshotOf = (store: MemoryStore): MemoryStore => ({
	pages: new Map(store.pages),
	quizzes: new Map(store.quizzes),
	quizAggregates: new Map(store.quizAggregates),
	quizVersions: new Map(store.quizVersions),
	answeredQuestionIds: new Set(store.answeredQuestionIds),
});

export const restoreInto = (
	store: MemoryStore,
	snapshot: MemoryStore,
): void => {
	store.pages = new Map(snapshot.pages);
	store.quizzes = new Map(snapshot.quizzes);
	store.quizAggregates = new Map(snapshot.quizAggregates);
	store.quizVersions = new Map(snapshot.quizVersions);
	store.answeredQuestionIds = new Set(snapshot.answeredQuestionIds);
};

export const pageIdsOf = (store: MemoryStore): readonly FolderId[] =>
	[...store.pages.keys()].map((id) => id as FolderId);
