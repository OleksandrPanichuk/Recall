import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { OwnerId } from "@/application/ports/owner";
import type {
	PageMatch,
	PageRepository,
	PageRevision,
	RevisionAuthor,
} from "@/application/ports/repositories/page.repository";
import {
	type Folder,
	type FolderId,
	MAX_FOLDER_DEPTH,
	restoreFolder,
	toFolderId,
} from "@/domain/folder/folder";
import {
	type QuizSetId,
	type QuizSetStatus,
	toQuizSetId,
} from "@/domain/quiz-set/quiz-set";
import { pageRevisions, pages, quizAttachments, quizzes } from "../schema";
import type { Executor } from "../unit-of-work";
import { isUuid } from "../uuid";

type PageRow = typeof pages.$inferSelect;

const toPage = (row: PageRow): Folder =>
	restoreFolder({
		id: toFolderId(row.id),
		name: row.title,
		parentId: row.parentId === null ? undefined : toFolderId(row.parentId),
		summary: row.contentMd ?? undefined,
		icon: row.icon ?? undefined,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});

export const EXCERPT_RADIUS = 120;

export const excerptAround = (
	content: string | null,
	query: string,
): string | undefined => {
	if (content === null || content.length === 0) {
		return undefined;
	}

	const found = content.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
	const start = found === -1 ? 0 : Math.max(0, found - EXCERPT_RADIUS);
	const excerpt = content
		.slice(start, start + EXCERPT_RADIUS * 2)
		.replace(/\s+/g, " ")
		.trim();

	return `${start === 0 ? "" : "…"}${excerpt}${start + EXCERPT_RADIUS * 2 >= content.length ? "" : "…"}`;
};

export const slugOf = (name: string): string => {
	const slug = name
		.normalize("NFKD")
		.toLocaleLowerCase()
		.replace(/[^\p{Letter}\p{Number}]+/gu, "-")
		.replace(/^-+|-+$/g, "");

	return slug.length === 0 ? "page" : slug;
};

export function createPagePostgresRepository(
	executor: Executor,
	owner: OwnerId,
): PageRepository {
	const mine = eq(pages.ownerId, owner);
	const ownedPair = async (
		id: FolderId,
		quizId: QuizSetId,
	): Promise<{ pageId: string; quizId: string } | undefined> => {
		if (!isUuid(String(id)) || !isUuid(String(quizId))) {
			return undefined;
		}

		const [page] = await executor
			.select({ id: pages.id })
			.from(pages)
			.where(and(mine, eq(pages.id, String(id))))
			.limit(1);
		const [quiz] = await executor
			.select({ id: quizzes.id })
			.from(quizzes)
			.where(and(eq(quizzes.ownerId, owner), eq(quizzes.id, String(quizId))))
			.limit(1);

		return page === undefined || quiz === undefined
			? undefined
			: { pageId: page.id, quizId: quiz.id };
	};
	const byId = async (id: string): Promise<Folder | undefined> => {
		if (!isUuid(id)) {
			return undefined;
		}

		const [row] = await executor
			.select()
			.from(pages)
			.where(and(mine, eq(pages.id, id)))
			.limit(1);

		return row === undefined ? undefined : toPage(row);
	};

	return {
		async save(page: Folder): Promise<void> {
			const slug = slugOf(page.name);
			const values = {
				id: String(page.id),
				ownerId: owner,
				parentId: page.parentId === undefined ? null : String(page.parentId),
				title: page.name,
				slug,
				contentMd: page.summary ?? null,
				icon: page.icon ?? null,
				createdAt: page.createdAt,
				updatedAt: page.updatedAt,
			};

			await executor
				.insert(pages)
				.values(values)
				.onConflictDoUpdate({
					target: pages.id,
					set: {
						parentId: values.parentId,
						title: values.title,
						slug: values.slug,
						contentMd: values.contentMd,
						icon: values.icon,
						updatedAt: values.updatedAt,
					},
				});
		},

		findById(id: FolderId): Promise<Folder | undefined> {
			return byId(String(id));
		},

		async listChildren(
			parentId: FolderId | undefined,
		): Promise<readonly Folder[]> {
			if (parentId !== undefined && !isUuid(String(parentId))) {
				return [];
			}

			const rows = await executor
				.select()
				.from(pages)
				.where(
					and(
						mine,
						parentId === undefined
							? isNull(pages.parentId)
							: eq(pages.parentId, String(parentId)),
					),
				)
				.orderBy(asc(pages.title), asc(pages.id));

			return rows.map(toPage);
		},

		async listAncestors(id: FolderId): Promise<readonly Folder[]> {
			const chain: Folder[] = [];
			let current = (await byId(String(id)))?.parentId;

			for (
				let step = 0;
				step < MAX_FOLDER_DEPTH && current !== undefined;
				step += 1
			) {
				const parent = await byId(String(current));

				if (parent === undefined) {
					break;
				}

				chain.unshift(parent);
				current = parent.parentId;
			}

			return chain;
		},

		async listAll(): Promise<readonly Folder[]> {
			const rows = await executor
				.select()
				.from(pages)
				.where(mine)
				.orderBy(asc(pages.title), asc(pages.id));

			return rows.map(toPage);
		},

		async countQuizzesIn(
			id: FolderId,
			statuses?: readonly QuizSetStatus[],
		): Promise<number> {
			if (!isUuid(String(id))) {
				return 0;
			}

			const [row] = await executor
				.select({ total: count() })
				.from(quizzes)
				.where(
					and(
						eq(quizzes.ownerId, owner),
						eq(quizzes.pageId, String(id)),
						statuses === undefined
							? undefined
							: inArray(quizzes.status, [...statuses]),
					),
				);

			return Number(row?.total ?? 0);
		},

		async countChildPages(id: FolderId): Promise<number> {
			if (!isUuid(String(id))) {
				return 0;
			}

			const [row] = await executor
				.select({ total: count() })
				.from(pages)
				.where(and(mine, eq(pages.parentId, String(id))));

			return Number(row?.total ?? 0);
		},

		async attachQuiz(id: FolderId, quizId: QuizSetId): Promise<void> {
			const owned = await ownedPair(id, quizId);

			if (owned === undefined) {
				return;
			}

			await executor
				.insert(quizAttachments)
				.values({ pageId: owned.pageId, quizId: owned.quizId })
				.onConflictDoNothing();
		},

		async detachQuiz(id: FolderId, quizId: QuizSetId): Promise<void> {
			const owned = await ownedPair(id, quizId);

			if (owned === undefined) {
				return;
			}

			await executor
				.delete(quizAttachments)
				.where(
					and(
						eq(quizAttachments.pageId, owned.pageId),
						eq(quizAttachments.quizId, owned.quizId),
					),
				);
		},

		async listAttachedQuizIds(id: FolderId): Promise<readonly QuizSetId[]> {
			if (!isUuid(String(id))) {
				return [];
			}

			const rows = await executor
				.select({ quizId: quizAttachments.quizId })
				.from(quizAttachments)
				.innerJoin(pages, eq(pages.id, quizAttachments.pageId))
				.innerJoin(quizzes, eq(quizzes.id, quizAttachments.quizId))
				.where(
					and(
						mine,
						eq(quizzes.ownerId, owner),
						eq(quizAttachments.pageId, String(id)),
					),
				)
				.orderBy(asc(quizAttachments.position), asc(quizAttachments.quizId));

			return rows.map((row) => toQuizSetId(row.quizId));
		},

		async recordRevision(revision: PageRevision): Promise<void> {
			if (!isUuid(String(revision.pageId))) {
				return;
			}

			const [owned] = await executor
				.select({ id: pages.id })
				.from(pages)
				.where(and(mine, eq(pages.id, String(revision.pageId))))
				.limit(1);

			if (owned === undefined) {
				return;
			}

			await executor.insert(pageRevisions).values({
				id: revision.id,
				pageId: owned.id,
				title: revision.title,
				contentMd: revision.summary ?? null,
				authorKind: revision.authorKind,
				createdAt: revision.createdAt,
			});
		},

		async listRevisions(
			id: FolderId,
			limit = 20,
		): Promise<readonly PageRevision[]> {
			if (!isUuid(String(id))) {
				return [];
			}

			const rows = await executor
				.select({
					id: pageRevisions.id,
					pageId: pageRevisions.pageId,
					title: pageRevisions.title,
					contentMd: pageRevisions.contentMd,
					authorKind: pageRevisions.authorKind,
					createdAt: pageRevisions.createdAt,
				})
				.from(pageRevisions)
				.innerJoin(pages, eq(pages.id, pageRevisions.pageId))
				.where(and(mine, eq(pageRevisions.pageId, String(id))))
				.orderBy(desc(pageRevisions.createdAt), desc(pageRevisions.id))
				.limit(limit);

			return rows.map((row) => ({
				id: row.id,
				pageId: toFolderId(row.pageId),
				title: row.title,
				summary: row.contentMd ?? undefined,
				authorKind: row.authorKind as RevisionAuthor,
				createdAt: row.createdAt,
			}));
		},

		async search(query: string, limit = 20): Promise<readonly PageMatch[]> {
			const trimmed = query.trim();

			if (trimmed.length === 0) {
				return [];
			}

			const rows = await executor
				.select({
					id: pages.id,
					title: pages.title,
					contentMd: pages.contentMd,
				})
				.from(pages)
				.where(
					and(
						mine,
						sql`(
							to_tsvector('simple', ${pages.title} || ' ' || coalesce(${pages.contentMd}, ''))
							@@ plainto_tsquery('simple', ${trimmed})
							or ${pages.title} ilike ${`%${trimmed}%`}
						)`,
					),
				)
				.orderBy(asc(pages.title))
				.limit(limit);

			return rows.map((row) => ({
				id: toFolderId(row.id),
				name: row.title,
				excerpt: excerptAround(row.contentMd, trimmed),
			}));
		},

		async delete(id: FolderId): Promise<void> {
			if (!isUuid(String(id))) {
				return;
			}

			await executor.delete(pages).where(and(mine, eq(pages.id, String(id))));
		},
	};
}
