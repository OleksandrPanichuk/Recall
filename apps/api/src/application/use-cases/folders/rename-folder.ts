import type { Clock } from "@/application/ports/clock";
import type { FolderRepository } from "@/application/ports/repositories/folder.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { Command, UseCase } from "@/application/use-case";
import {
	assertPlacement,
	type FolderId,
	renameFolder,
} from "@/domain/folder/folder";
import { type FolderDependencies, requireFolder } from "./create-folder";

export interface RenameFolderCommand {
	readonly folderId: FolderId;
	readonly name: string;
}

export class RenameFolderUseCase
	implements UseCase<Command<RenameFolderCommand>, void>
{
	private readonly folders: FolderRepository;
	private readonly clock: Clock;
	private readonly transaction: Transaction;

	constructor(dependencies: FolderDependencies) {
		this.folders = dependencies.folders;
		this.clock = dependencies.clock;
		this.transaction = dependencies.transaction;
	}

	async execute(request: Command<RenameFolderCommand>): Promise<void> {
		this.transaction.run(() => {
			const stored = requireFolder(this.folders, request.folderId);
			const renamed = renameFolder(stored, request.name, this.clock.now());

			assertPlacement(
				renamed,
				this.folders.listAncestors(renamed.id),
				this.folders.listChildren(renamed.parentId),
			);
			this.folders.save(renamed);
		});
	}
}
