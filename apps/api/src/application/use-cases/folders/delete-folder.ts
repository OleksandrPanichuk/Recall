import type { FolderRepository } from "@/application/ports/repositories/folder.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { Command, UseCase } from "@/application/use-case";
import type { FolderId } from "@/domain/folder/folder";
import { type FolderDependencies, requireFolder } from "./create-folder";

export class FolderNotEmptyError extends Error {
	readonly folderId: FolderId;
	readonly children: number;
	readonly sets: number;

	constructor(folderId: FolderId, children: number, sets: number) {
		const held = [
			children === 0 ? undefined : `${children} folder(s)`,
			sets === 0 ? undefined : `${sets} set(s)`,
		].filter((part) => part !== undefined);

		super(`Folder ${folderId} still holds ${held.join(" and ")}`);
		this.name = "FolderNotEmptyError";
		this.folderId = folderId;
		this.children = children;
		this.sets = sets;
	}
}

export interface DeleteFolderCommand {
	readonly folderId: FolderId;
}

export class DeleteFolderUseCase
	implements UseCase<Command<DeleteFolderCommand>, void>
{
	private readonly folders: FolderRepository;
	private readonly transaction: Transaction;

	constructor(dependencies: FolderDependencies) {
		this.folders = dependencies.folders;
		this.transaction = dependencies.transaction;
	}

	async execute(request: Command<DeleteFolderCommand>): Promise<void> {
		this.transaction.run(() => {
			const folder = requireFolder(this.folders, request.folderId);
			const children = this.folders.countChildFolders(folder.id);
			const sets = this.folders.countSetsIn(folder.id);

			if (children > 0 || sets > 0) {
				throw new FolderNotEmptyError(folder.id, children, sets);
			}

			this.folders.delete(folder.id);
		});
	}
}
