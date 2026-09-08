import { Injectable } from "@nestjs/common";
import type { PageEntity, PageId } from "./page.entity";
import { FolderNotFoundError } from "./pages.errors";
import { PagesRepository } from "./pages.repository";

@Injectable()
export class PagesService {
	constructor(private readonly pages: PagesRepository) {}

	async require(id: PageId): Promise<PageEntity> {
		const page = await this.pages.findById(id);

		if (page === undefined) {
			throw new FolderNotFoundError(id);
		}

		return page;
	}

	async parentChain(
		parentId: PageId | undefined,
	): Promise<readonly PageEntity[]> {
		if (parentId === undefined) {
			return [];
		}

		const parent = await this.require(parentId);

		return [...(await this.pages.listAncestors(parent.id)), parent];
	}
}
