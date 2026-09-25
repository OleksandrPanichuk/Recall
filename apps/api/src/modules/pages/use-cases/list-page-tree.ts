import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import type { PageEntity, PageId } from "../page.entity";
import { PagesRepository } from "../pages.repository";

export interface PageTreeNode {
	readonly id: PageId;
	readonly name: string;
	readonly icon?: string;
	readonly parentId?: PageId;
	readonly depth: number;
	readonly setCount: number;
	readonly unpublishedCount: number;
}

type Options = void;
type Result = readonly PageTreeNode[];

@Injectable()
export class ListPageTreeUseCase extends UseCase<Options, Result> {
	constructor(private readonly pages: PagesRepository) {
		super();
	}

	async execute(): Promise<Result> {
		const all = await this.pages.listAll();
		const counts = await this.pages.contentCounts();
		const childrenByParent = new Map<string, PageEntity[]>();

		for (const page of all) {
			const key = page.parentId ?? "";

			childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), page]);
		}

		const nodes: PageTreeNode[] = [];
		const walk = (parentId: PageId | undefined, depth: number): void => {
			for (const page of childrenByParent.get(parentId ?? "") ?? []) {
				const setCount = counts.get(page.id)?.publishedQuizzes ?? 0;
				const total = counts.get(page.id)?.quizzes ?? 0;

				nodes.push({
					id: page.id,
					name: page.name,
					icon: page.icon,
					parentId: page.parentId,
					depth,
					setCount,
					unpublishedCount: total - setCount,
				});
				walk(page.id, depth + 1);
			}
		};

		walk(undefined, 0);

		return nodes;
	}
}
