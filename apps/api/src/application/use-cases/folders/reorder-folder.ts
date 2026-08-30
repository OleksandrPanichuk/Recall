import type { Clock } from "@/application/ports/clock";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type { Command, UseCase } from "@/application/use-case";
import {
	type Folder,
	type FolderId,
	reorderFolder,
} from "@/domain/folder/folder";
import { FolderValidationError } from "@/domain/folder/folder.errors";
import {
	canSitBetween,
	positionBetween,
	renumbered,
} from "@/domain/folder/ordering";
import { type FolderDependencies, requireFolder } from "./create-folder";

export interface ReorderFolderCommand {
	readonly folderId: FolderId;
	readonly afterId?: FolderId;
	readonly beforeId?: FolderId;
}

const positionOf = (
	siblings: readonly Folder[],
	id: FolderId | undefined,
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

export class ReorderFolderUseCase
	implements UseCase<Command<ReorderFolderCommand>, void>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;

	constructor(dependencies: FolderDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
	}

	async execute(request: Command<ReorderFolderCommand>): Promise<void> {
		await this.unitOfWork.run(async ({ pages }) => {
			const moved = await requireFolder(pages, request.folderId);

			if (request.afterId === moved.id || request.beforeId === moved.id) {
				throw new FolderValidationError([
					"a page cannot be placed next to itself",
				]);
			}

			const at = this.clock.now();
			const others = (await pages.listChildren(moved.parentId)).filter(
				(sibling) => sibling.id !== moved.id,
			);

			let after = positionOf(others, request.afterId);
			let before = positionOf(others, request.beforeId);

			if (!canSitBetween(after, before)) {
				const spaced = renumbered(others.length);

				for (const [index, sibling] of others.entries()) {
					await pages.save(reorderFolder(sibling, spaced[index] as number, at));
				}

				after = positionOf(
					others.map((sibling, index) => ({
						...sibling,
						position: spaced[index] as number,
					})),
					request.afterId,
				);
				before = positionOf(
					others.map((sibling, index) => ({
						...sibling,
						position: spaced[index] as number,
					})),
					request.beforeId,
				);
			}

			await pages.save(
				reorderFolder(moved, positionBetween(after, before), at),
			);
		});
	}
}
