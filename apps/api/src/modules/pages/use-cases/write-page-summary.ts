import { Injectable } from "@nestjs/common";
import { Clock } from "@/core/ports/clock";
import { IdGenerator } from "@/core/ports/id-generator";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { PageEntity, type PageId } from "../page.entity";
import type { RevisionAuthor } from "../pages.repository";
import { PagesRepository } from "../pages.repository";
import { PagesService } from "../pages.service";

export interface WriteSummaryUseCaseOptions {
	readonly folderId: PageId;
	readonly summary?: string;
	readonly append?: boolean;
	readonly authorKind?: RevisionAuthor;
}

export interface WrittenSummary {
	readonly folderId: PageId;
	readonly name: string;
	readonly length: number;
}

type Options = WriteSummaryUseCaseOptions;
type Result = WrittenSummary;

const joined = (
	existing: string | undefined,
	addition: string | undefined,
): string | undefined => {
	if (addition === undefined || addition.trim().length === 0) {
		return existing;
	}

	return existing === undefined || existing.trim().length === 0
		? addition
		: `${existing.trimEnd()}\n\n${addition}`;
};

@Injectable()
export class WriteSummaryUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly pages: PagesRepository,
		private readonly service: PagesService,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
		private readonly ids: IdGenerator,
	) {
		super();
	}

	execute({ folderId, summary, append, authorKind }: Options): Promise<Result> {
		return this.transaction.run(async () => {
			const page = await this.service.require(folderId);
			const at = this.clock.now();

			if (page.summary !== undefined) {
				await this.pages.recordRevision({
					id: this.ids.generate(),
					pageId: page.id,
					title: page.name,
					summary: page.summary,
					authorKind: authorKind ?? "user",
					createdAt: at,
				});
			}

			const next = append === true ? joined(page.summary, summary) : summary;
			const written = PageEntity.withSummary(page, next, at);

			await this.pages.save(written);

			return {
				folderId: written.id,
				name: written.name,
				length: written.summary?.length ?? 0,
			};
		});
	}
}
