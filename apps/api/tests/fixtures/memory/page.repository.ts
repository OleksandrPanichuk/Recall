import type {
	PageMatch,
	PageRepository,
	PageRevision,
	PageShare,
} from "@tests/fixtures/repository-scope";
import {
	excerptAround,
	type LinkedQuizFilter,
	type LinkedQuizId,
	type LinkedQuizSummary,
	PageEntity,
	type PageId,
	slugOf,
} from "@/modules/pages";
import { type QuizSetId, QuizSetStatus } from "@/modules/quizzes";
import type { MemoryStore } from "./store";

export class DuplicateSlugError extends Error {
	constructor(parentId: string | undefined, slug: string) {
		super(
			`pages_parent_slug_unique: ${parentId ?? "root"} already holds the slug ${slug}`,
		);
		this.name = "DuplicateSlugError";
	}
}

const byName = (left: PageEntity, right: PageEntity): number =>
	left.name === right.name
		? String(left.id).localeCompare(String(right.id))
		: left.name.localeCompare(right.name);

const summariesOf = (store: MemoryStore): LinkedQuizSummary[] =>
	[...store.quizAggregates.values()].map((quiz) => ({
		id: quiz.id,
		title: quiz.title,
		status: quiz.status,
		questionCount: quiz.questions.length,
		updatedAt: quiz.updatedAt,
	}));

const byPosition = (left: PageEntity, right: PageEntity): number =>
	left.position === right.position
		? byName(left, right)
		: left.position - right.position;

export function createMemoryPageRepository(store: MemoryStore): PageRepository {
	return {
		async save(page: PageEntity): Promise<void> {
			const slug = slugOf(page.name);
			const clash = [...store.pages.values()].find(
				(candidate) =>
					String(candidate.id) !== String(page.id) &&
					String(candidate.parentId ?? "") === String(page.parentId ?? "") &&
					slugOf(candidate.name) === slug,
			);

			if (clash !== undefined) {
				throw new DuplicateSlugError(
					page.parentId === undefined ? undefined : String(page.parentId),
					slug,
				);
			}

			store.pages.set(String(page.id), page);
		},

		async findById(id: PageId): Promise<PageEntity | undefined> {
			return store.pages.get(String(id));
		},

		async listChildren(
			parentId: PageId | undefined,
		): Promise<readonly PageEntity[]> {
			return [...store.pages.values()]
				.filter(
					(page) => String(page.parentId ?? "") === String(parentId ?? ""),
				)
				.sort(byPosition);
		},

		async listAncestors(id: PageId): Promise<readonly PageEntity[]> {
			const chain: PageEntity[] = [];
			let current = store.pages.get(String(id))?.parentId;

			for (
				let step = 0;
				step < PageEntity.MAX_DEPTH && current !== undefined;
				step += 1
			) {
				const parent = store.pages.get(String(current));

				if (parent === undefined) {
					break;
				}

				chain.unshift(parent);
				current = parent.parentId;
			}

			return chain;
		},

		async listAll(): Promise<readonly PageEntity[]> {
			return [...store.pages.values()].sort(byPosition);
		},

		async countQuizzesIn(
			id: PageId,
			statuses?: readonly QuizSetStatus[],
		): Promise<number> {
			return [...store.quizzes.values()].filter(
				(quiz) =>
					quiz.pageId === String(id) &&
					(statuses === undefined || statuses.includes(quiz.status)),
			).length;
		},

		async findLinkedQuiz(
			id: LinkedQuizId,
		): Promise<LinkedQuizSummary | undefined> {
			return summariesOf(store).find((quiz) => String(quiz.id) === String(id));
		},

		async listPublishedQuizzes(
			filter: LinkedQuizFilter,
		): Promise<readonly LinkedQuizSummary[]> {
			return summariesOf(store)
				.filter((quiz) => quiz.status === QuizSetStatus.Published)
				.filter((quiz) => {
					if (filter.pageId === undefined) {
						return true;
					}

					const aggregate = store.quizAggregates.get(String(quiz.id));

					return filter.pageId === null
						? aggregate?.folderId === undefined
						: String(aggregate?.folderId ?? "") === String(filter.pageId);
				})
				.filter(
					(quiz) =>
						filter.ids === undefined ||
						filter.ids.some((id) => String(id) === String(quiz.id)),
				)
				.sort((left, right) => left.title.localeCompare(right.title));
		},

		async countChildPages(id: PageId): Promise<number> {
			return [...store.pages.values()].filter(
				(page) => String(page.parentId ?? "") === String(id),
			).length;
		},

		async attachQuiz(id: PageId, quizId: QuizSetId): Promise<void> {
			const attached = store.attachments.get(String(id)) ?? new Set<string>();

			attached.add(String(quizId));
			store.attachments.set(String(id), attached);
		},

		async detachQuiz(id: PageId, quizId: QuizSetId): Promise<void> {
			store.attachments.get(String(id))?.delete(String(quizId));
		},

		async listAttachedQuizIds(id: PageId): Promise<readonly QuizSetId[]> {
			return [...(store.attachments.get(String(id)) ?? [])]
				.sort()
				.map((quizId) => quizId as QuizSetId);
		},

		async recordRevision(revision: PageRevision): Promise<void> {
			store.revisions.push(revision);
		},

		async listRevisions(
			id: PageId,
			limit = 20,
		): Promise<readonly PageRevision[]> {
			return store.revisions
				.filter((revision) => String(revision.pageId) === String(id))
				.sort(
					(left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
				)
				.slice(0, limit);
		},

		async search(query: string, limit = 20): Promise<readonly PageMatch[]> {
			const trimmed = query.trim().toLocaleLowerCase();

			if (trimmed.length === 0) {
				return [];
			}

			return [...store.pages.values()]
				.filter(
					(page) =>
						page.name.toLocaleLowerCase().includes(trimmed) ||
						(page.summary ?? "").toLocaleLowerCase().includes(trimmed),
				)
				.sort(byName)
				.slice(0, limit)
				.map((page) => ({
					id: page.id,
					name: page.name,
					excerpt: excerptAround(page.summary ?? null, trimmed),
				}));
		},

		async shareOf(id: PageId): Promise<PageShare | undefined> {
			return store.shares.get(String(id));
		},

		async saveShare(share: PageShare): Promise<void> {
			if (!store.pages.has(String(share.pageId))) {
				return;
			}

			store.shares.set(String(share.pageId), share);
		},

		async deleteShare(id: PageId): Promise<void> {
			store.shares.delete(String(id));
		},

		async delete(id: PageId): Promise<void> {
			store.revisions = store.revisions.filter(
				(revision) => String(revision.pageId) !== String(id),
			);
			store.attachments.delete(String(id));
			store.shares.delete(String(id));
			store.pages.delete(String(id));
		},
	};
}
