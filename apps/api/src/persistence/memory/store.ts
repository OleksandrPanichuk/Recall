import type {
	PageRevision,
	PageShare,
} from "@/application/ports/repositories/page.repository";
import type { QuizAttempt } from "@/domain/quiz-attempt/quiz-attempt";
import type { RepetitionSchedule } from "@/domain/repetition/repetition";
import type { QuizSettings } from "@/domain/settings/quiz-settings";
import type { AttachmentEntity } from "@/modules/attachments";
import { PageEntity, type PageId } from "@/modules/pages";
import { QuizSetEntity, QuizSetStatus } from "@/modules/quizzes";
import { TermPairEntity } from "@/modules/vocabulary";

export interface MemoryQuiz {
	readonly id: string;
	readonly pageId: string | undefined;
	readonly status: QuizSetStatus;
}

export interface MemoryStore {
	pages: Map<string, PageEntity>;
	attachments: Map<string, Set<string>>;
	revisions: PageRevision[];
	shares: Map<string, PageShare>;
	files: Map<string, AttachmentEntity>;
	quizzes: Map<string, MemoryQuiz>;
	quizAggregates: Map<string, QuizSetEntity>;
	quizVersions: Map<string, number>;
	answeredQuestionIds: Set<string>;
	attempts: Map<string, QuizAttempt>;
	schedules: Map<string, RepetitionSchedule>;
	settings: Map<string, QuizSettings>;
	termPairs: Map<string, TermPairEntity>;
}

export const emptyStore = (): MemoryStore => ({
	pages: new Map(),
	attachments: new Map(),
	revisions: [],
	shares: new Map(),
	files: new Map(),
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
	shares: new Map(store.shares),
	files: new Map(store.files),
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
	store.shares = new Map(snapshot.shares);
	store.files = new Map(snapshot.files);
	store.quizzes = new Map(snapshot.quizzes);
	store.quizAggregates = new Map(snapshot.quizAggregates);
	store.quizVersions = new Map(snapshot.quizVersions);
	store.answeredQuestionIds = new Set(snapshot.answeredQuestionIds);
	store.attempts = new Map(snapshot.attempts);
	store.schedules = new Map(snapshot.schedules);
	store.settings = new Map(snapshot.settings);
	store.termPairs = new Map(snapshot.termPairs);
};

export const pageIdsOf = (store: MemoryStore): readonly PageId[] =>
	[...store.pages.keys()].map((id) => id as PageId);
