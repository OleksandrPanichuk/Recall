import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import type { PageId } from "../page.entity";
import type { PageRevision } from "../pages.repository";
import { PagesRepository } from "../pages.repository";
import { PagesService } from "../pages.service";

export interface ListPageRevisionsUseCaseOptions {
	readonly folderId: PageId;
	readonly limit?: number;
}

type Options = ListPageRevisionsUseCaseOptions;
type Result = readonly PageRevision[];

@Injectable()
export class ListPageRevisionsUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly pages: PagesRepository,
		private readonly service: PagesService,
	) {
		super();
	}

	async execute({ folderId, limit }: Options): Promise<Result> {
		const page = await this.service.require(folderId);

		return this.pages.listRevisions(page.id, limit);
	}
}
