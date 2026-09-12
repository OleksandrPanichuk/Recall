import { Injectable } from "@nestjs/common";
import { Clock } from "@/core/ports/clock";
import { IdGenerator } from "@/core/ports/id-generator";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { PageEntity, type PageId, toPageId } from "../page.entity";
import { PagePosition } from "../page.ordering";
import { PagesRepository } from "../pages.repository";
import { PagesService } from "../pages.service";

export interface CreatePageUseCaseOptions {
	readonly name: string;
	readonly parentId?: PageId;
}

export interface CreatedPage {
	readonly folderId: PageId;
}

type Options = CreatePageUseCaseOptions;
type Result = CreatedPage;

@Injectable()
export class CreatePageUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly pages: PagesRepository,
		private readonly service: PagesService,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
		private readonly ids: IdGenerator,
	) {
		super();
	}

	execute({ name, parentId }: Options): Promise<Result> {
		return this.transaction.run(async () => {
			const siblings = await this.pages.listChildren(parentId);
			const page = PageEntity.create({
				id: toPageId(this.ids.generate()),
				name,
				parentId,
				position: PagePosition.lastAmong(siblings),
				createdAt: this.clock.now(),
			});

			PageEntity.assertPlacement(
				page,
				await this.service.parentChain(parentId),
				siblings,
			);
			await this.pages.save(page);

			return { folderId: page.id };
		});
	}
}
