import type { Clock } from "@/application/ports/clock";
import type { FolderRepository } from "@/application/ports/repositories/folder.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { Command, UseCase } from "@/application/use-case";
import {
	assertPlacement,
	type Folder,
	type FolderId,
	MAX_FOLDER_DEPTH,
	reparentFolder,
} from "@/domain/folder/folder";
import { FolderDepthError } from "@/domain/folder/folder.errors";
import {
	type FolderDependencies,
	parentChain,
	requireFolder,
} from "./create-folder";

function subtreeHeight(all: readonly Folder[], rootId: FolderId): number {
	const childrenByParent = new Map<FolderId, FolderId[]>();

	for (const folder of all) {
		if (folder.parentId === undefined) {
			continue;
		}

		childrenByParent.set(folder.parentId, [
			...(childrenByParent.get(folder.parentId) ?? []),
			folder.id,
		]);
	}

	let level: readonly FolderId[] = [rootId];
	let height = 0;

	while (level.length > 0 && height <= MAX_FOLDER_DEPTH) {
		height += 1;
		level = level.flatMap((id) => childrenByParent.get(id) ?? []);
	}

	return height;
}

export interface MoveFolderCommand {
	readonly folderId: FolderId;
	readonly parentId?: FolderId;
}

export class MoveFolder implements UseCase<Command<MoveFolderCommand>, void> {
	private readonly folders: FolderRepository;
	private readonly clock: Clock;
	private readonly transaction: Transaction;

	constructor(dependencies: FolderDependencies) {
		this.folders = dependencies.folders;
		this.clock = dependencies.clock;
		this.transaction = dependencies.transaction;
	}

	async execute(request: Command<MoveFolderCommand>): Promise<void> {
		this.transaction.run(() => {
			const stored = requireFolder(this.folders, request.folderId);
			const moved = reparentFolder(stored, request.parentId, this.clock.now());
			const ancestors = parentChain(this.folders, request.parentId);

			assertPlacement(
				moved,
				ancestors,
				this.folders.listChildren(request.parentId),
			);

			const deepestLeaf =
				ancestors.length + subtreeHeight(this.folders.listAll(), moved.id);

			if (deepestLeaf > MAX_FOLDER_DEPTH) {
				throw new FolderDepthError(deepestLeaf, MAX_FOLDER_DEPTH);
			}

			this.folders.save(moved);
		});
	}
}
