import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { FolderRepository } from "@/application/ports/repositories/folder.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { Command, UseCase } from "@/application/use-case";
import {
	assertPlacement,
	createFolder,
	type Folder,
	type FolderId,
	toFolderId,
} from "@/domain/folder/folder";

export class FolderNotFoundError extends Error {
	readonly folderId: FolderId;

	constructor(folderId: FolderId) {
		super(`Folder ${folderId} does not exist`);
		this.name = "FolderNotFoundError";
		this.folderId = folderId;
	}
}

export interface FolderDependencies {
	readonly folders: FolderRepository;
	readonly clock: Clock;
	readonly idGenerator: IdGenerator;
	readonly transaction: Transaction;
}

export function requireFolder(
	folders: FolderRepository,
	folderId: FolderId,
): Folder {
	const folder = folders.findById(folderId);

	if (folder === undefined) {
		throw new FolderNotFoundError(folderId);
	}

	return folder;
}

export function parentChain(
	folders: FolderRepository,
	parentId: FolderId | undefined,
): readonly Folder[] {
	if (parentId === undefined) {
		return [];
	}

	const parent = requireFolder(folders, parentId);

	return [...folders.listAncestors(parent.id), parent];
}

export interface CreateFolderCommand {
	readonly name: string;
	readonly parentId?: FolderId;
}

export interface CreateFolderResult {
	readonly folderId: FolderId;
}

export class CreateFolderUseCase
	implements UseCase<Command<CreateFolderCommand>, CreateFolderResult>
{
	private readonly folders: FolderRepository;
	private readonly clock: Clock;
	private readonly idGenerator: IdGenerator;
	private readonly transaction: Transaction;

	constructor(dependencies: FolderDependencies) {
		this.folders = dependencies.folders;
		this.clock = dependencies.clock;
		this.idGenerator = dependencies.idGenerator;
		this.transaction = dependencies.transaction;
	}

	async execute(
		request: Command<CreateFolderCommand>,
	): Promise<CreateFolderResult> {
		return this.transaction.run(() => {
			const folder = createFolder({
				id: toFolderId(this.idGenerator.generate()),
				name: request.name,
				parentId: request.parentId,
				createdAt: this.clock.now(),
			});

			assertPlacement(
				folder,
				parentChain(this.folders, request.parentId),
				this.folders.listChildren(request.parentId),
			);
			this.folders.save(folder);

			return { folderId: folder.id };
		});
	}
}
