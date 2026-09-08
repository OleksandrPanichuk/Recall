import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import type { PageMatch } from "../pages.repository";
import { PagesRepository } from "../pages.repository";

export interface SearchPagesUseCaseOptions {
	readonly query: string;
	readonly limit?: number;
}

type Options = SearchPagesUseCaseOptions;
type Result = readonly PageMatch[];

@Injectable()
export class SearchPagesUseCase extends UseCase<Options, Result> {
	constructor(private readonly pages: PagesRepository) {
		super();
	}

	execute({ query, limit }: Options): Promise<Result> {
		return this.pages.search(query, limit);
	}
}
