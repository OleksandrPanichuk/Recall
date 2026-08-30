import type {
	PageMatch,
	PageRepository,
	PageRevision,
} from "@/application/ports/repositories/page.repository";
import {
	type Folder,
	type FolderId,
	MAX_FOLDER_DEPTH,
} from "@/domain/folder/folder";
import type { QuizSetId, QuizSetStatus } from "@/domain/quiz-set/quiz-set";
import {
	excerptAround,
	slugOf,
} from "../postgres/repositories/page.repository";
import type { MemoryStore } from "./store";

export class DuplicateSlugError extends Error {
	constructor(parentId: string | undefined, slug: string) {
		super(
			`pages_parent_slug_unique: ${parentId ?? "root"} already holds the slug ${slug}`,
		);
		this.name = "DuplicateSlugError";
	}
}

const byName = (left: Folder, right: Folder): number =>
	left.name === right.name
		? String(left.id).localeCompare(String(right.id))
		: left.name.localeCompare(right.name);

export function createMemoryPageRepository(store: MemoryStore): PageRepository {
	return {
		async save(page: Folder): Promise<void> {
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

		async findById(id: FolderId): Promise<Folder | undefined> {
			return store.pages.get(String(id));
		},

		async listChildren(
			parentId: FolderId | undefined,
		): Promise<readonly Folder[]> {
			return [...store.pages.values()]
				.filter(
					(page) => String(page.parentId ?? "") === String(parentId ?? ""),
				)
				.sort(byName);
		},

		async listAncestors(id: FolderId): Promise<readonly Folder[]> {
			const chain: Folder[] = [];
			let current = store.pages.get(String(id))?.parentId;

			for (
				let step = 0;
				step < MAX_FOLDER_DEPTH && current !== undefined;
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

		async listAll(): Promise<readonly Folder[]> {
			return [...store.pages.values()].sort(byName);
		},

		async countQuizzesIn(
			id: FolderId,
			statuses?: readonly QuizSetStatus[],
		): Promise<number> {
			return [...store.quizzes.values()].filter(
				(quiz) =>
					quiz.pageId === String(id) &&
					(statuses === undefined || statuses.includes(quiz.status)),
			).length;
		},

		async countChildPages(id: FolderId): Promise<number> {
			return [...store.pages.values()].filter(
				(page) => String(page.parentId ?? "") === String(id),
			).length;
		},

		async attachQuiz(id: FolderId, quizId: QuizSetId): Promise<void> {
			const attached = store.attachments.get(String(id)) ?? new Set<string>();

			attached.add(String(quizId));
			store.attachments.set(String(id), attached);
		},

		async detachQuiz(id: FolderId, quizId: QuizSetId): Promise<void> {
			store.attachments.get(String(id))?.delete(String(quizId));
		},

		async listAttachedQuizIds(id: FolderId): Promise<readonly QuizSetId[]> {
			return [...(store.attachments.get(String(id)) ?? [])]
				.sort()
				.map((quizId) => quizId as QuizSetId);
		},

		async recordRevision(revision: PageRevision): Promise<void> {
			store.revisions.push(revision);
		},

		async listRevisions(
			id: FolderId,
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

		async delete(id: FolderId): Promise<void> {
			store.revisions = store.revisions.filter(
				(revision) => String(revision.pageId) !== String(id),
			);
			store.attachments.delete(String(id));
			store.pages.delete(String(id));
		},
	};
}
