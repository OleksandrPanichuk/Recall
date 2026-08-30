import type { Clock } from "@/application/ports/clock";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type { Command, UseCase } from "@/application/use-case";
import { type FolderId, setIcon } from "@/domain/folder/folder";
import { type FolderDependencies, requireFolder } from "./create-folder";

export interface SetPageIconCommand {
	readonly folderId: FolderId;
	readonly icon?: string;
}

export class SetPageIconUseCase
	implements UseCase<Command<SetPageIconCommand>, void>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;

	constructor(dependencies: FolderDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
	}

	async execute(request: Command<SetPageIconCommand>): Promise<void> {
		await this.unitOfWork.run(async ({ pages }) => {
			const stored = await requireFolder(pages, request.folderId);

			await pages.save(setIcon(stored, request.icon, this.clock.now()));
		});
	}
}
