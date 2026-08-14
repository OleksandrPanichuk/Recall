import type { FolderRepository } from "@/application/ports/repositories/folder.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { Folder, FolderId } from "@/domain/folder/folder";
import { QuizSetStatus } from "@/domain/quiz-set/quiz-set";

export interface FolderTreeNode {
	readonly id: FolderId;
	readonly name: string;
	readonly parentId?: FolderId;
	readonly depth: number;
	readonly setCount: number;
}

export type ListFolderTreeCommand = Record<string, never>;

export interface ListFolderTreeDependencies {
	readonly folders: FolderRepository;
}

const published = [QuizSetStatus.Published];

export class ListFolderTree
	implements UseCase<Command<ListFolderTreeCommand>, readonly FolderTreeNode[]>
{
	private readonly folders: FolderRepository;

	constructor(dependencies: ListFolderTreeDependencies) {
		this.folders = dependencies.folders;
	}

	async execute(
		_request: Command<ListFolderTreeCommand>,
	): Promise<readonly FolderTreeNode[]> {
		const all = this.folders.listAll();
		const childrenByParent = new Map<string, Folder[]>();

		for (const folder of all) {
			const key = folder.parentId ?? "";

			childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), folder]);
		}

		const nodes: FolderTreeNode[] = [];
		const walk = (parentId: FolderId | undefined, depth: number): void => {
			for (const folder of childrenByParent.get(parentId ?? "") ?? []) {
				nodes.push({
					id: folder.id,
					name: folder.name,
					parentId: folder.parentId,
					depth,
					setCount: this.folders.countSetsIn(folder.id, published),
				});
				walk(folder.id, depth + 1);
			}
		};

		walk(undefined, 0);

		return nodes;
	}
}
