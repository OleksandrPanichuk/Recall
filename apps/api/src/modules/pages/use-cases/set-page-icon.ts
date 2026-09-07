import { Injectable } from "@nestjs/common";
import { Clock } from "@/core/ports/clock";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { PageEntity, type PageId } from "../page.entity";
import { PagesRepository } from "../pages.repository";
import { PagesService } from "../pages.service";

export interface SetPageIconUseCaseOptions {
	readonly folderId: PageId;
	readonly icon?: string;
}

type Options = SetPageIconUseCaseOptions;

@Injectable()
export class SetPageIconUseCase extends UseCase<Options, void> {
	constructor(
		private readonly pages: PagesRepository,
		private readonly service: PagesService,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
	) {
		super();
	}

	async execute({ folderId, icon }: Options): Promise<void> {
		await this.transaction.run(async () => {
			const stored = await this.service.require(folderId);

			await this.pages.save(
				PageEntity.withIcon(stored, icon, this.clock.now()),
			);
		});
	}
}
