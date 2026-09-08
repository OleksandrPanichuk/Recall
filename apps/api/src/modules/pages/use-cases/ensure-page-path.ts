import { Injectable } from "@nestjs/common";
import { Clock } from "@/core/ports/clock";
import { IdGenerator } from "@/core/ports/id-generator";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { PageEntity, type PageId, toPageId } from "../page.entity";
import { FolderDepthError, FolderValidationError } from "../pages.errors";
import { PagesRepository } from "../pages.repository";
import { PagesService } from "../pages.service";

export interface EnsurePagePathUseCaseOptions {
	readonly path: readonly string[];
}

export interface EnsuredPagePath {
	readonly folderId: PageId;
	readonly created: readonly string[];
}

type Options = EnsurePagePathUseCaseOptions;
type Result = EnsuredPagePath;

@Injectable()
export class EnsurePagePathUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly pages: PagesRepository,
		private readonly service: PagesService,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
		private readonly ids: IdGenerator,
	) {
		super();
	}

	async execute({ path }: Options): Promise<Result> {
		const segments = path.map((segment) => segment.trim());

		if (segments.length === 0 || segments.some((s) => s.length === 0)) {
			throw new FolderValidationError(["path must not contain empty segments"]);
		}

		if (segments.length > PageEntity.MAX_DEPTH) {
			throw new FolderDepthError(segments.length, PageEntity.MAX_DEPTH);
		}

		return this.transaction.run(async () => {
			const created: string[] = [];
			let parentId: PageId | undefined;

			for (const segment of segments) {
				const siblings = await this.pages.listChildren(parentId);
				const existing = siblings.find(
					(sibling) =>
						sibling.name.toLocaleLowerCase() === segment.toLocaleLowerCase(),
				);

				if (existing !== undefined) {
					parentId = existing.id;
					continue;
				}

				const page = PageEntity.create({
					id: toPageId(this.ids.generate()),
					name: segment,
					parentId,
					createdAt: this.clock.now(),
				});

				PageEntity.assertPlacement(
					page,
					await this.service.parentChain(parentId),
					siblings,
				);
				await this.pages.save(page);
				created.push(page.name);
				parentId = page.id;
			}

			if (parentId === undefined) {
				throw new FolderValidationError(["path must not be empty"]);
			}

			return { folderId: parentId, created };
		});
	}
}
