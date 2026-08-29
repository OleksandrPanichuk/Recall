import type { PageRevision } from "@/application/ports/repositories/page.repository";
import type { Folder, FolderId } from "@/domain/folder/folder";
import type { QuizAttempt } from "@/domain/quiz-attempt/quiz-attempt";
import type { QuizSet, QuizSetStatus } from "@/domain/quiz-set/quiz-set";
import type { RepetitionSchedule } from "@/domain/repetition/repetition";
import type { QuizSettings } from "@/domain/settings/quiz-settings";
import type { VocabularyItem } from "@/domain/vocabulary/vocabulary-item";

export interface MemoryQuiz {
	readonly id: string;
	readonly pageId: string | undefined;
	readonly status: QuizSetStatus;
}

export interface MemoryStore {
	pages: Map<string, Folder>;
	attachments: Map<string, Set<string>>;
	revisions: PageRevision[];
	quizzes: Map<string, MemoryQuiz>;
	quizAggregates: Map<string, QuizSet>;
	quizVersions: Map<string, number>;
	answeredQuestionIds: Set<string>;
	attempts: Map<string, QuizAttempt>;
	schedules: Map<string, RepetitionSchedule>;
	settings: Map<string, QuizSettings>;
	termPairs: Map<string, VocabularyItem>;
}

export const emptyStore = (): MemoryStore => ({
	pages: new Map(),
	attachments: new Map(),
	revisions: [],
	quizzes: new Map(),
	quizAggregates: new Map(),
	quizVersions: new Map(),
	answeredQuestionIds: new Set(),
	attempts: new Map(),
	schedules: new Map(),
	settings: new Map(),
	termPairs: new Map(),
});

export const snapshotOf = (store: MemoryStore): MemoryStore => ({
	pages: new Map(store.pages),
	attachments: new Map(
		[...store.attachments].map(([page, ids]) => [page, new Set(ids)]),
	),
	revisions: [...store.revisions],
	quizzes: new Map(store.quizzes),
	quizAggregates: new Map(store.quizAggregates),
	quizVersions: new Map(store.quizVersions),
	answeredQuestionIds: new Set(store.answeredQuestionIds),
	attempts: new Map(store.attempts),
	schedules: new Map(store.schedules),
	settings: new Map(store.settings),
	termPairs: new Map(store.termPairs),
});

export const restoreInto = (
	store: MemoryStore,
	snapshot: MemoryStore,
): void => {
	store.pages = new Map(snapshot.pages);
	store.attachments = new Map(
		[...snapshot.attachments].map(([page, ids]) => [page, new Set(ids)]),
	);
	store.revisions = [...snapshot.revisions];
	store.quizzes = new Map(snapshot.quizzes);
	store.quizAggregates = new Map(snapshot.quizAggregates);
	store.quizVersions = new Map(snapshot.quizVersions);
	store.answeredQuestionIds = new Set(snapshot.answeredQuestionIds);
	store.attempts = new Map(snapshot.attempts);
	store.schedules = new Map(snapshot.schedules);
	store.settings = new Map(snapshot.settings);
	store.termPairs = new Map(snapshot.termPairs);
};

export const pageIdsOf = (store: MemoryStore): readonly FolderId[] =>
	[...store.pages.keys()].map((id) => id as FolderId);
