import { Injectable } from "@nestjs/common";
import { Clock } from "@/core/ports/clock";
import { IdGenerator } from "@/core/ports/id-generator";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { type PageId, PagesService } from "@/modules/pages";
import { PageShareEntity } from "../page-share.entity";
import { PageSharesRepository } from "../page-shares.repository";

export interface SharePageUseCaseOptions {
	readonly folderId: PageId;
	readonly rotate?: boolean;
}

export interface SharedPage {
	readonly folderId: PageId;
	readonly name: string;
	readonly token: string;
	readonly createdAt: Date;
}

type Options = SharePageUseCaseOptions;
type Result = SharedPage;

@Injectable()
export class SharePageUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly shares: PageSharesRepository,
		private readonly pages: PagesService,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
		private readonly tokens: IdGenerator,
	) {
		super();
	}

	execute({ folderId, rotate }: Options): Promise<Result> {
		return this.transaction.run(async () => {
			const page = await this.pages.require(folderId);
			const existing = await this.shares.shareOf(page.id);

			if (existing !== undefined && rotate !== true) {
				return {
					folderId: page.id,
					name: page.name,
					token: existing.token,
					createdAt: existing.createdAt,
				};
			}

			const share: PageShareEntity = {
				pageId: page.id,
				token: PageShareEntity.mintToken(() => this.tokens.generate()),
				createdAt: this.clock.now(),
			};

			await this.shares.save(share);

			return {
				folderId: page.id,
				name: page.name,
				token: share.token,
				createdAt: share.createdAt,
			};
		});
	}
}

export interface UnsharePageUseCaseOptions {
	readonly folderId: PageId;
}

@Injectable()
export class UnsharePageUseCase extends UseCase<
	UnsharePageUseCaseOptions,
	void
> {
	constructor(
		private readonly shares: PageSharesRepository,
		private readonly pages: PagesService,
		private readonly transaction: Transaction,
	) {
		super();
	}

	async execute({ folderId }: UnsharePageUseCaseOptions): Promise<void> {
		await this.transaction.run(async () => {
			const page = await this.pages.require(folderId);

			await this.shares.delete(page.id);
		});
	}
}
