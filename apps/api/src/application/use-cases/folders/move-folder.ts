import type { Clock } from "@/application/ports/clock";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
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

export class MoveFolderUseCase
	implements UseCase<Command<MoveFolderCommand>, void>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;

	constructor(dependencies: FolderDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
	}

	async execute(request: Command<MoveFolderCommand>): Promise<void> {
		await this.unitOfWork.run(async ({ pages }) => {
			const stored = await requireFolder(pages, request.folderId);
			const moved = reparentFolder(stored, request.parentId, this.clock.now());
			const ancestors = await parentChain(pages, request.parentId);

			assertPlacement(
				moved,
				ancestors,
				await pages.listChildren(request.parentId),
			);

			const deepestLeaf =
				ancestors.length + subtreeHeight(await pages.listAll(), moved.id);

			if (deepestLeaf > MAX_FOLDER_DEPTH) {
				throw new FolderDepthError(deepestLeaf, MAX_FOLDER_DEPTH);
			}

			await pages.save(moved);
		});
	}
}
