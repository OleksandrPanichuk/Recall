import type {
	PageMatch,
	RepositoryScope,
} from "@/application/ports/repositories/page.repository";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";

export interface SearchPagesCommand {
	readonly query: string;
	readonly limit?: number;
}

export type SearchPagesDependencies = ApplicationDependencies;

export class SearchPagesUseCase
	implements UseCase<Command<SearchPagesCommand>, readonly PageMatch[]>
{
	private readonly scope: RepositoryScope;

	constructor(dependencies: SearchPagesDependencies) {
		this.scope = dependencies.scope;
	}

	execute(request: Command<SearchPagesCommand>): Promise<readonly PageMatch[]> {
		return this.scope.pages.search(request.query, request.limit);
	}
}
