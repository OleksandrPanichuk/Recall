import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import type { OwnerId } from "@/application/ports/owner";
import type { PageRepository } from "@/application/ports/repositories/page.repository";
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
import { pages, quizAttachments, quizzes } from "../schema";
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

		async delete(id: FolderId): Promise<void> {
			if (!isUuid(String(id))) {
				return;
			}

			await executor.delete(pages).where(and(mine, eq(pages.id, String(id))));
		},
	};
}
