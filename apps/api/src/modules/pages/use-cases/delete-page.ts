import { Injectable } from "@nestjs/common";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import type { PageId } from "../page.entity";
import { FolderNotEmptyError } from "../pages.errors";
import { PagesRepository } from "../pages.repository";
import { PagesService } from "../pages.service";

export interface DeletePageUseCaseOptions {
	readonly folderId: PageId;
}

type Options = DeletePageUseCaseOptions;

@Injectable()
export class DeletePageUseCase extends UseCase<Options, void> {
	constructor(
		private readonly pages: PagesRepository,
		private readonly service: PagesService,
		private readonly transaction: Transaction,
	) {
		super();
	}

	async execute({ folderId }: Options): Promise<void> {
		await this.transaction.run(async () => {
			const page = await this.service.require(folderId);
			const children = await this.pages.countChildPages(page.id);
			const sets = await this.pages.countQuizzesIn(page.id);

			if (children > 0 || sets > 0) {
				throw new FolderNotEmptyError(page.id, children, sets);
			}

			await this.pages.delete(page.id);
		});
	}
}
