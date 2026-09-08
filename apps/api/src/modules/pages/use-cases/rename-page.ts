import { Injectable } from "@nestjs/common";
import { Clock } from "@/core/ports/clock";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { PageEntity, type PageId } from "../page.entity";
import { PagesRepository } from "../pages.repository";
import { PagesService } from "../pages.service";

export interface RenamePageUseCaseOptions {
	readonly folderId: PageId;
	readonly name: string;
}

type Options = RenamePageUseCaseOptions;

@Injectable()
export class RenamePageUseCase extends UseCase<Options, void> {
	constructor(
		private readonly pages: PagesRepository,
		private readonly service: PagesService,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
	) {
		super();
	}

	async execute({ folderId, name }: Options): Promise<void> {
		await this.transaction.run(async () => {
			const stored = await this.service.require(folderId);
			const renamed = PageEntity.renamed(stored, name, this.clock.now());

			PageEntity.assertPlacement(
				renamed,
				await this.pages.listAncestors(renamed.id),
				await this.pages.listChildren(renamed.parentId),
			);
			await this.pages.save(renamed);
		});
	}
}
