import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type {
	RepositoryScope,
	RevisionAuthor,
} from "@/application/ports/repositories/page.repository";
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
	readonly append?: boolean;
	readonly authorKind?: RevisionAuthor;
}

export interface WrittenSummary {
	readonly folderId: FolderId;
	readonly name: string;
	readonly length: number;
}

export type WriteSummaryDependencies = ApplicationDependencies;

const joined = (
	existing: string | undefined,
	addition: string | undefined,
): string | undefined => {
	if (addition === undefined || addition.trim().length === 0) {
		return existing;
	}

	return existing === undefined || existing.trim().length === 0
		? addition
		: `${existing.trimEnd()}\n\n${addition}`;
};

export class WriteSummaryUseCase
	implements UseCase<Command<WriteSummaryCommand>, WrittenSummary>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;
	private readonly idGenerator: IdGenerator;

	constructor(dependencies: WriteSummaryDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
		this.idGenerator = dependencies.idGenerator;
	}

	execute(request: Command<WriteSummaryCommand>): Promise<WrittenSummary> {
		return this.unitOfWork.run(async ({ pages }) => {
			const page = await requireFolder(pages, request.folderId);
			const at = this.clock.now();

			if (page.summary !== undefined) {
				await pages.recordRevision({
					id: this.idGenerator.generate(),
					pageId: page.id,
					title: page.name,
					summary: page.summary,
					authorKind: request.authorKind ?? "user",
					createdAt: at,
				});
			}

			const next =
				request.append === true
					? joined(page.summary, request.summary)
					: request.summary;
			const written = writeSummary(page, next, at);

			await pages.save(written);

			return {
				folderId: written.id,
				name: written.name,
				length: written.summary?.length ?? 0,
			};
		});
	}
}
