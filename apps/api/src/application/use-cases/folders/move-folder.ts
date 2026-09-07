import type { Clock } from "@/application/ports/clock";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type { Command, UseCase } from "@/application/use-case";
import { FolderDepthError, PageEntity, type PageId } from "@/modules/pages";
import {
	type FolderDependencies,
	lastPositionAmong,
	parentChain,
	requireFolder,
} from "./create-folder";

function subtreeHeight(all: readonly PageEntity[], rootId: PageId): number {
	const childrenByParent = new Map<PageId, PageId[]>();

	for (const folder of all) {
		if (folder.parentId === undefined) {
			continue;
		}

		childrenByParent.set(folder.parentId, [
			...(childrenByParent.get(folder.parentId) ?? []),
			folder.id,
		]);
	}

	let level: readonly PageId[] = [rootId];
	let height = 0;

	while (level.length > 0 && height <= PageEntity.MAX_DEPTH) {
		height += 1;
		level = level.flatMap((id) => childrenByParent.get(id) ?? []);
	}

	return height;
}

export interface MoveFolderCommand {
	readonly folderId: PageId;
	readonly parentId?: PageId;
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
			const at = this.clock.now();
			const moved = PageEntity.reparented(stored, request.parentId, at);
			const ancestors = await parentChain(pages, request.parentId);
			const siblings = (await pages.listChildren(request.parentId)).filter(
				(sibling) => sibling.id !== moved.id,
			);

			PageEntity.assertPlacement(moved, ancestors, siblings);

			const deepestLeaf =
				ancestors.length + subtreeHeight(await pages.listAll(), moved.id);

			if (deepestLeaf > PageEntity.MAX_DEPTH) {
				throw new FolderDepthError(deepestLeaf, PageEntity.MAX_DEPTH);
			}

			await pages.save(
				stored.parentId === request.parentId
					? moved
					: PageEntity.reordered(moved, lastPositionAmong(siblings), at),
			);
		});
	}
}
