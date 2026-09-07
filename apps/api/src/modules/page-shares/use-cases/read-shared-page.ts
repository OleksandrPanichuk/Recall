import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import { type PageId, PagesRepository } from "@/modules/pages";
import { PageNotSharedError } from "../page-shares.errors";
import { PageSharesRepository } from "../page-shares.repository";

export interface ReadSharedPageUseCaseOptions {
	readonly folderId: PageId;
}

export interface SharedPageView {
	readonly name: string;
	readonly icon?: string;
	readonly summary?: string;
	readonly updatedAt: Date;
}

type Options = ReadSharedPageUseCaseOptions;
type Result = SharedPageView;

@Injectable()
export class ReadSharedPageUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly shares: PageSharesRepository,
		private readonly pages: PagesRepository,
	) {
		super();
	}

	async execute({ folderId }: Options): Promise<Result> {
		const share = await this.shares.shareOf(folderId);

		if (share === undefined) {
			throw new PageNotSharedError();
		}

		const page = await this.pages.findById(folderId);

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
