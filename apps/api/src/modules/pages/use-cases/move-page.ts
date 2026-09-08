import { Injectable } from "@nestjs/common";
import { Clock } from "@/core/ports/clock";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { PageEntity, type PageId } from "../page.entity";
import { PagePosition } from "../page.ordering";
import { FolderDepthError } from "../pages.errors";
import { PagesRepository } from "../pages.repository";
import { PagesService } from "../pages.service";

export interface MovePageUseCaseOptions {
	readonly folderId: PageId;
	readonly parentId?: PageId;
}

type Options = MovePageUseCaseOptions;

function subtreeHeight(all: readonly PageEntity[], rootId: PageId): number {
	const childrenByParent = new Map<PageId, PageId[]>();

	for (const page of all) {
		if (page.parentId === undefined) {
			continue;
		}

		childrenByParent.set(page.parentId, [
			...(childrenByParent.get(page.parentId) ?? []),
			page.id,
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

@Injectable()
export class MovePageUseCase extends UseCase<Options, void> {
	constructor(
		private readonly pages: PagesRepository,
		private readonly service: PagesService,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
	) {
		super();
	}

	async execute({ folderId, parentId }: Options): Promise<void> {
		await this.transaction.run(async () => {
			const stored = await this.service.require(folderId);
			const at = this.clock.now();
			const moved = PageEntity.reparented(stored, parentId, at);
			const ancestors = await this.service.parentChain(parentId);
			const siblings = (await this.pages.listChildren(parentId)).filter(
				(sibling) => sibling.id !== moved.id,
			);

			PageEntity.assertPlacement(moved, ancestors, siblings);

			const deepestLeaf =
				ancestors.length + subtreeHeight(await this.pages.listAll(), moved.id);

			if (deepestLeaf > PageEntity.MAX_DEPTH) {
				throw new FolderDepthError(deepestLeaf, PageEntity.MAX_DEPTH);
			}

			await this.pages.save(
				stored.parentId === parentId
					? moved
					: PageEntity.reordered(moved, PagePosition.lastAmong(siblings), at),
			);
		});
	}
}
