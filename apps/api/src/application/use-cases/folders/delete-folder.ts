import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type { Command, UseCase } from "@/application/use-case";
import { type PageId } from "@/modules/pages";
import { type FolderDependencies, requireFolder } from "./create-folder";

export class FolderNotEmptyError extends Error {
	readonly folderId: PageId;
	readonly children: number;
	readonly sets: number;

	constructor(folderId: PageId, children: number, sets: number) {
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
	readonly folderId: PageId;
}

export class DeleteFolderUseCase
	implements UseCase<Command<DeleteFolderCommand>, void>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;

	constructor(dependencies: FolderDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
	}

	async execute(request: Command<DeleteFolderCommand>): Promise<void> {
		await this.unitOfWork.run(async ({ pages }) => {
			const folder = await requireFolder(pages, request.folderId);
			const children = await pages.countChildPages(folder.id);
			const sets = await pages.countQuizzesIn(folder.id);

			if (children > 0 || sets > 0) {
				throw new FolderNotEmptyError(folder.id, children, sets);
			}

			await pages.delete(folder.id);
		});
	}
}
