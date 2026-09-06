import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import type { FolderId } from "@/domain/folder/folder";

export class PageNotSharedError extends Error {
	constructor() {
		super("That link does not point at a shared page");
		this.name = "PageNotSharedError";
	}
}

export interface ReadSharedPageCommand {
	readonly folderId: FolderId;
}

export interface SharedPageView {
	readonly name: string;
	readonly icon?: string;
	readonly summary?: string;
	readonly updatedAt: Date;
}

export type ReadSharedPageDependencies = ApplicationDependencies;

export class ReadSharedPageUseCase
	implements UseCase<Command<ReadSharedPageCommand>, SharedPageView>
{
	private readonly scope: RepositoryScope;

	constructor(dependencies: ReadSharedPageDependencies) {
		this.scope = dependencies.scope;
	}

	async execute(
		request: Command<ReadSharedPageCommand>,
	): Promise<SharedPageView> {
		const { pages } = this.scope;
		const share = await pages.shareOf(request.folderId);

		if (share === undefined) {
			throw new PageNotSharedError();
		}

		const page = await pages.findById(request.folderId);

		if (page === undefined) {
			throw new PageNotSharedError();
		}

		return {
			name: page.name,
			icon: page.icon,
			summary: page.summary,
			updatedAt: page.updatedAt,
		};
	}
}
