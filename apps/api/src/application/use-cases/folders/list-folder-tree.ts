import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { Folder, FolderId } from "@/domain/folder/folder";
import { QuizSetStatus } from "@/domain/quiz-set/quiz-set";

export interface FolderTreeNode {
	readonly id: FolderId;
	readonly name: string;
	readonly parentId?: FolderId;
	readonly depth: number;
	readonly setCount: number;
	readonly unpublishedCount: number;
}

export type ListFolderTreeCommand = Record<string, never>;

export interface ListFolderTreeDependencies {
	readonly scope: RepositoryScope;
}

const published = [QuizSetStatus.Published];

export class ListFolderTreeUseCase
	implements UseCase<Command<ListFolderTreeCommand>, readonly FolderTreeNode[]>
{
	private readonly scope: RepositoryScope;

	constructor(dependencies: ListFolderTreeDependencies) {
		this.scope = dependencies.scope;
	}

	async execute(
		_request: Command<ListFolderTreeCommand>,
	): Promise<readonly FolderTreeNode[]> {
		const all = await this.scope.pages.listAll();
		const childrenByParent = new Map<string, Folder[]>();

		for (const folder of all) {
			const key = folder.parentId ?? "";

			childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), folder]);
		}

		const nodes: FolderTreeNode[] = [];

		const walk = async (
			parentId: FolderId | undefined,
			depth: number,
		): Promise<void> => {
			for (const folder of childrenByParent.get(parentId ?? "") ?? []) {
				const setCount = await this.scope.pages.countQuizzesIn(
					folder.id,
					published,
				);
				const total = await this.scope.pages.countQuizzesIn(folder.id);

				nodes.push({
					id: folder.id,
					name: folder.name,
					parentId: folder.parentId,
					depth,
					setCount,
					unpublishedCount: total - setCount,
				});
				await walk(folder.id, depth + 1);
			}
		};

		await walk(undefined, 0);

		return nodes;
	}
}
