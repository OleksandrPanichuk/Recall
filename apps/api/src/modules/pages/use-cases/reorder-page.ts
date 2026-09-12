import { Injectable } from "@nestjs/common";
import { Clock } from "@/core/ports/clock";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { PageEntity, type PageId } from "../page.entity";
import { PagePosition } from "../page.ordering";
import { FolderValidationError } from "../pages.errors";
import { PagesRepository } from "../pages.repository";
import { PagesService } from "../pages.service";

export interface ReorderPageUseCaseOptions {
	readonly folderId: PageId;
	readonly afterId?: PageId;
	readonly beforeId?: PageId;
}

type Options = ReorderPageUseCaseOptions;

const positionOf = (
	siblings: readonly PageEntity[],
	id: PageId | undefined,
): number | undefined => {
	if (id === undefined) {
		return undefined;
	}

	const sibling = siblings.find((candidate) => candidate.id === id);

	if (sibling === undefined) {
		throw new FolderValidationError([
			"a page can only be placed next to one of its own siblings",
		]);
	}

	return sibling.position;
};

@Injectable()
export class ReorderPageUseCase extends UseCase<Options, void> {
	constructor(
		private readonly pages: PagesRepository,
		private readonly service: PagesService,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
	) {
		super();
	}

	async execute({ folderId, afterId, beforeId }: Options): Promise<void> {
		await this.transaction.run(async () => {
			const moved = await this.service.require(folderId);

			if (afterId === moved.id || beforeId === moved.id) {
				throw new FolderValidationError([
					"a page cannot be placed next to itself",
				]);
			}

			const at = this.clock.now();
			const others = (await this.pages.listChildren(moved.parentId)).filter(
				(sibling) => sibling.id !== moved.id,
			);

			let after = positionOf(others, afterId);
			let before = positionOf(others, beforeId);

			if (!PagePosition.canSitBetween(after, before)) {
				const spaced = PagePosition.renumbered(others.length);

				for (const [index, sibling] of others.entries()) {
					await this.pages.save(
						PageEntity.reordered(sibling, spaced[index] as number, at),
					);
				}

				const respaced = others.map((sibling, index) => ({
					...sibling,
					position: spaced[index] as number,
				}));

				after = positionOf(respaced, afterId);
				before = positionOf(respaced, beforeId);
			}

			await this.pages.save(
				PageEntity.reordered(moved, PagePosition.between(after, before), at),
			);
		});
	}
}
