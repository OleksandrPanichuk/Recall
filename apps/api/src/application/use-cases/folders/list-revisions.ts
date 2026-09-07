import type {
	PageRevision,
	RepositoryScope,
} from "@/application/ports/repositories/page.repository";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import { type PageId } from "@/modules/pages";
import { requireFolder } from "./create-folder";

export interface ListRevisionsCommand {
	readonly folderId: PageId;
	readonly limit?: number;
}

export type ListRevisionsDependencies = ApplicationDependencies;

export class ListRevisionsUseCase
	implements UseCase<Command<ListRevisionsCommand>, readonly PageRevision[]>
{
	private readonly scope: RepositoryScope;

	constructor(dependencies: ListRevisionsDependencies) {
		this.scope = dependencies.scope;
	}

	async execute(
		request: Command<ListRevisionsCommand>,
	): Promise<readonly PageRevision[]> {
		const { pages } = this.scope;
		const page = await requireFolder(pages, request.folderId);

		return pages.listRevisions(page.id, request.limit);
	}
}
