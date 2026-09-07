import { Injectable } from "@nestjs/common";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
	pageRevisions,
	pageShares,
	pages,
	quizAttachments,
	quizzes,
} from "@/db/schema";
import { isUuid } from "@/db/uuid";
import { PageEntity, type PageId, toPageId } from "../page.entity";
import {
	type LinkedQuizId,
	type LinkedQuizStatus,
	toLinkedQuizId,
} from "../page.quiz-link";

type PageRow = typeof pages.$inferSelect;

const toPage = (row: PageRow): PageEntity =>
	PageEntity.restore({
		id: toPageId(row.id),
		name: row.title,
		parentId: row.parentId === null ? undefined : toPageId(row.parentId),
		summary: row.contentMd ?? undefined,
		icon: row.icon ?? undefined,
		position: Number(row.position),
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

import { OwnerContext } from "@/core/owner-context";
import { Database } from "@/db/connection";
import { DatabaseExecutor } from "@/db/executor";
import type {
	PageMatch,
	PageRevision,
	PageShare,
	RevisionAuthor,
} from "../pages.repository";
import { PagesRepository } from "../pages.repository";

@Injectable()
export class PostgresPagesRepository extends PagesRepository {
	constructor(
		private readonly database: Database,
		private readonly owners: OwnerContext,
	) {
		super();
	}

	private get executor() {
		return DatabaseExecutor.for(this.database.db);
	}

	private get owner() {
		return this.owners.current();
	}

	private get mine() {
		return eq(pages.ownerId, this.owner);
	}

	private async ownedPair(
		id: PageId,
		quizId: LinkedQuizId,
	): Promise<{ pageId: string; quizId: string } | undefined> {
		if (!isUuid(String(id)) || !isUuid(String(quizId))) {
			return undefined;
		}

		const [page] = await this.executor
			.select({ id: pages.id })
			.from(pages)
			.where(and(this.mine, eq(pages.id, String(id))))
			.limit(1);
		const [quiz] = await this.executor
			.select({ id: quizzes.id })
			.from(quizzes)
			.where(
				and(eq(quizzes.ownerId, this.owner), eq(quizzes.id, String(quizId))),
			)
			.limit(1);

		return page === undefined || quiz === undefined
			? undefined
			: { pageId: page.id, quizId: quiz.id };
	}
	private async byId(id: string): Promise<PageEntity | undefined> {
		if (!isUuid(id)) {
			return undefined;
		}

		const [row] = await this.executor
			.select()
			.from(pages)
			.where(and(this.mine, eq(pages.id, id)))
			.limit(1);

		return row === undefined ? undefined : toPage(row);
	}

	async save(page: PageEntity): Promise<void> {
		const slug = slugOf(page.name);
		const values = {
			id: String(page.id),
			ownerId: this.owner,
			parentId: page.parentId === undefined ? null : String(page.parentId),
			title: page.name,
			slug,
			contentMd: page.summary ?? null,
			icon: page.icon ?? null,
			position: String(page.position),
			createdAt: page.createdAt,
			updatedAt: page.updatedAt,
		};

		await this.executor
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
					position: values.position,
					updatedAt: values.updatedAt,
				},
			});
	}

	findById(id: PageId): Promise<PageEntity | undefined> {
		return this.byId(String(id));
	}

	async listChildren(
		parentId: PageId | undefined,
	): Promise<readonly PageEntity[]> {
		if (parentId !== undefined && !isUuid(String(parentId))) {
			return [];
		}

		const rows = await this.executor
			.select()
			.from(pages)
			.where(
				and(
					this.mine,
					parentId === undefined
						? isNull(pages.parentId)
						: eq(pages.parentId, String(parentId)),
				),
			)
			.orderBy(asc(pages.position), asc(pages.title), asc(pages.id));

		return rows.map(toPage);
	}

	async listAncestors(id: PageId): Promise<readonly PageEntity[]> {
		const chain: PageEntity[] = [];
		let current = (await this.byId(String(id)))?.parentId;

		for (
			let step = 0;
			step < PageEntity.MAX_DEPTH && current !== undefined;
			step += 1
		) {
			const parent = await this.byId(String(current));

			if (parent === undefined) {
				break;
			}

			chain.unshift(parent);
			current = parent.parentId;
		}

		return chain;
	}

	async listAll(): Promise<readonly PageEntity[]> {
		const rows = await this.executor
			.select()
			.from(pages)
			.where(this.mine)
			.orderBy(asc(pages.position), asc(pages.title), asc(pages.id));

		return rows.map(toPage);
	}

	async countQuizzesIn(
		id: PageId,
		statuses?: readonly LinkedQuizStatus[],
	): Promise<number> {
		if (!isUuid(String(id))) {
			return 0;
		}

		const [row] = await this.executor
			.select({ total: count() })
			.from(quizzes)
			.where(
				and(
					eq(quizzes.ownerId, this.owner),
					eq(quizzes.pageId, String(id)),
					statuses === undefined
						? undefined
						: inArray(quizzes.status, [...statuses]),
				),
			);

		return Number(row?.total ?? 0);
	}

	async countChildPages(id: PageId): Promise<number> {
		if (!isUuid(String(id))) {
			return 0;
		}

		const [row] = await this.executor
			.select({ total: count() })
			.from(pages)
			.where(and(this.mine, eq(pages.parentId, String(id))));

		return Number(row?.total ?? 0);
	}

	async attachQuiz(id: PageId, quizId: LinkedQuizId): Promise<void> {
		const owned = await this.ownedPair(id, quizId);

		if (owned === undefined) {
			return;
		}

		await this.executor
			.insert(quizAttachments)
			.values({ pageId: owned.pageId, quizId: owned.quizId })
			.onConflictDoNothing();
	}

	async detachQuiz(id: PageId, quizId: LinkedQuizId): Promise<void> {
		const owned = await this.ownedPair(id, quizId);

		if (owned === undefined) {
			return;
		}

		await this.executor
			.delete(quizAttachments)
			.where(
				and(
					eq(quizAttachments.pageId, owned.pageId),
					eq(quizAttachments.quizId, owned.quizId),
				),
			);
	}

	async listAttachedQuizIds(id: PageId): Promise<readonly LinkedQuizId[]> {
		if (!isUuid(String(id))) {
			return [];
		}

		const rows = await this.executor
			.select({ quizId: quizAttachments.quizId })
			.from(quizAttachments)
			.innerJoin(pages, eq(pages.id, quizAttachments.pageId))
			.innerJoin(quizzes, eq(quizzes.id, quizAttachments.quizId))
			.where(
				and(
					this.mine,
					eq(quizzes.ownerId, this.owner),
					eq(quizAttachments.pageId, String(id)),
				),
			)
			.orderBy(asc(quizAttachments.position), asc(quizAttachments.quizId));

		return rows.map((row) => toLinkedQuizId(row.quizId));
	}

	async recordRevision(revision: PageRevision): Promise<void> {
		if (!isUuid(String(revision.pageId))) {
			return;
		}

		const [owned] = await this.executor
			.select({ id: pages.id })
			.from(pages)
			.where(and(this.mine, eq(pages.id, String(revision.pageId))))
			.limit(1);

		if (owned === undefined) {
			return;
		}

		await this.executor.insert(pageRevisions).values({
			id: revision.id,
			pageId: owned.id,
			title: revision.title,
			contentMd: revision.summary ?? null,
			authorKind: revision.authorKind,
			createdAt: revision.createdAt,
		});
	}

	async listRevisions(
		id: PageId,
		limit = 20,
	): Promise<readonly PageRevision[]> {
		if (!isUuid(String(id))) {
			return [];
		}

		const rows = await this.executor
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
			.where(and(this.mine, eq(pageRevisions.pageId, String(id))))
			.orderBy(desc(pageRevisions.createdAt), desc(pageRevisions.id))
			.limit(limit);

		return rows.map((row) => ({
			id: row.id,
			pageId: toPageId(row.pageId),
			title: row.title,
			summary: row.contentMd ?? undefined,
			authorKind: row.authorKind as RevisionAuthor,
			createdAt: row.createdAt,
		}));
	}

	async search(query: string, limit = 20): Promise<readonly PageMatch[]> {
		const trimmed = query.trim();

		if (trimmed.length === 0) {
			return [];
		}

		const rows = await this.executor
			.select({
				id: pages.id,
				title: pages.title,
				contentMd: pages.contentMd,
			})
			.from(pages)
			.where(
				and(
					this.mine,
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
			id: toPageId(row.id),
			name: row.title,
			excerpt: excerptAround(row.contentMd, trimmed),
		}));
	}

	async shareOf(id: PageId): Promise<PageShare | undefined> {
		if (!isUuid(String(id))) {
			return undefined;
		}

		const [row] = await this.executor
			.select()
			.from(pageShares)
			.where(
				and(
					eq(pageShares.ownerId, this.owner),
					eq(pageShares.pageId, String(id)),
				),
			)
			.limit(1);

		return row === undefined
			? undefined
			: {
					pageId: toPageId(row.pageId),
					token: row.token,
					createdAt: row.createdAt,
				};
	}

	async saveShare(share: PageShare): Promise<void> {
		if (!isUuid(String(share.pageId))) {
			return;
		}

		const [page] = await this.executor
			.select({ id: pages.id })
			.from(pages)
			.where(and(this.mine, eq(pages.id, String(share.pageId))))
			.limit(1);

		if (page === undefined) {
			return;
		}

		await this.executor
			.insert(pageShares)
			.values({
				ownerId: this.owner,
				pageId: page.id,
				token: share.token,
				createdAt: share.createdAt,
			})
			.onConflictDoUpdate({
				target: pageShares.pageId,
				set: { token: share.token, createdAt: share.createdAt },
			});
	}

	async deleteShare(id: PageId): Promise<void> {
		if (!isUuid(String(id))) {
			return;
		}

		await this.executor
			.delete(pageShares)
			.where(
				and(
					eq(pageShares.ownerId, this.owner),
					eq(pageShares.pageId, String(id)),
				),
			);
	}

	async delete(id: PageId): Promise<void> {
		if (!isUuid(String(id))) {
			return;
		}

		await this.executor
			.delete(pages)
			.where(and(this.mine, eq(pages.id, String(id))));
	}
}
