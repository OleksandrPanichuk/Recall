import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import type { PageId } from "../page.entity";
import { type LinkedQuizSummary, PUBLISHED } from "../page.quiz-link";
import { PagesRepository } from "../pages.repository";
import { PagesService } from "../pages.service";

export interface BrowseCrumb {
	readonly id: PageId;
	readonly name: string;
}

export interface BrowseChild extends BrowseCrumb {
	readonly itemCount: number;
}

export interface BrowseView {
	readonly folderId?: PageId;
	readonly name?: string;
	readonly parentId?: PageId;
	readonly summary?: string;
	readonly icon?: string;
	readonly breadcrumb: readonly BrowseCrumb[];
	readonly children: readonly BrowseChild[];
	readonly sets: readonly LinkedQuizSummary[];
	readonly attached: readonly LinkedQuizSummary[];
	readonly shareToken?: string;
}

export interface BrowseFolderUseCaseOptions {
	readonly folderId?: PageId;
}

type Options = BrowseFolderUseCaseOptions;

@Injectable()
export class BrowseFolderUseCase extends UseCase<Options, BrowseView> {
	constructor(
		private readonly pages: PagesRepository,
		private readonly pagesService: PagesService,
	) {
		super();
	}

	async execute(options: Options): Promise<BrowseView> {
		const current =
			options.folderId === undefined
				? undefined
				: await this.pagesService.require(options.folderId);

		const children: BrowseChild[] = [];

		for (const child of await this.pages.listChildren(options.folderId)) {
			children.push({
				id: child.id,
				name: child.name,
				itemCount:
					(await this.pages.countQuizzesIn(child.id, PUBLISHED)) +
					(await this.pages.countChildPages(child.id)),
			});
		}

		const ancestors =
			current === undefined ? [] : await this.pages.listAncestors(current.id);

		return {
			folderId: current?.id,
			name: current?.name,
			parentId: current?.parentId,
			summary: current?.summary,
			icon: current?.icon,
			breadcrumb: ancestors.map((folder) => ({
				id: folder.id,
				name: folder.name,
			})),
			children,
			sets: await this.pages.listPublishedQuizzes({
				pageId: current?.id ?? null,
			}),
			attached:
				current === undefined
					? []
					: await this.pages.listPublishedQuizzes({
							ids: await this.pages.listAttachedQuizIds(current.id),
						}),
			shareToken:
				current === undefined
					? undefined
					: (await this.pages.shareOf(current.id))?.token,
		};
	}
}
