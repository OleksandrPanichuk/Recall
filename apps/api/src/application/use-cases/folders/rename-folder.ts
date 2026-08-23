import type { Clock } from "@/application/ports/clock";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
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
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;

	constructor(dependencies: FolderDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
	}

	async execute(request: Command<RenameFolderCommand>): Promise<void> {
		await this.unitOfWork.run(async ({ pages }) => {
			const stored = await requireFolder(pages, request.folderId);
			const renamed = renameFolder(stored, request.name, this.clock.now());

			assertPlacement(
				renamed,
				await pages.listAncestors(renamed.id),
				await pages.listChildren(renamed.parentId),
			);
			await pages.save(renamed);
		});
	}
}
