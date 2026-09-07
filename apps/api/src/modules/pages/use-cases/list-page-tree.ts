import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import { QuizSetStatus } from "@/domain/quiz-set/quiz-set";
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

const published = [QuizSetStatus.Published];

@Injectable()
export class ListPageTreeUseCase extends UseCase<Options, Result> {
	constructor(private readonly pages: PagesRepository) {
		super();
	}

	async execute(): Promise<Result> {
		const all = await this.pages.listAll();
		const childrenByParent = new Map<string, PageEntity[]>();

		for (const page of all) {
			const key = page.parentId ?? "";

			childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), page]);
		}

		const nodes: PageTreeNode[] = [];
		const walk = async (
			parentId: PageId | undefined,
			depth: number,
		): Promise<void> => {
			for (const page of childrenByParent.get(parentId ?? "") ?? []) {
				const setCount = await this.pages.countQuizzesIn(page.id, published);
				const total = await this.pages.countQuizzesIn(page.id);

				nodes.push({
					id: page.id,
					name: page.name,
					icon: page.icon,
					parentId: page.parentId,
					depth,
					setCount,
					unpublishedCount: total - setCount,
				});
				await walk(page.id, depth + 1);
			}
		};

		await walk(undefined, 0);

		return nodes;
	}
}
