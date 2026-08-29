import type { Clock } from "@/application/ports/clock";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import { type FolderId, writeSummary } from "@/domain/folder/folder";
import { requireFolder } from "./create-folder";

export interface WriteSummaryCommand {
	readonly folderId: FolderId;
	readonly summary?: string;
}

export interface WrittenSummary {
	readonly folderId: FolderId;
	readonly name: string;
	readonly length: number;
}

export type WriteSummaryDependencies = ApplicationDependencies;

export class WriteSummaryUseCase
	implements UseCase<Command<WriteSummaryCommand>, WrittenSummary>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;

	constructor(dependencies: WriteSummaryDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
	}

	execute(request: Command<WriteSummaryCommand>): Promise<WrittenSummary> {
		return this.unitOfWork.run(async ({ pages }) => {
			const page = await requireFolder(pages, request.folderId);
			const written = writeSummary(page, request.summary, this.clock.now());

			await pages.save(written);

			return {
				folderId: written.id,
				name: written.name,
				length: written.summary?.length ?? 0,
			};
		});
	}
}
