import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import type { PageId } from "../page.entity";
import { FolderPathNotFoundError } from "../pages.errors";
import { PagesRepository } from "../pages.repository";

export interface ResolvePagePathUseCaseOptions {
	readonly path: readonly string[];
}

export interface ResolvedPagePath {
	readonly folderId: PageId;
}

type Options = ResolvePagePathUseCaseOptions;
type Result = ResolvedPagePath;

@Injectable()
export class ResolvePagePathUseCase extends UseCase<Options, Result> {
	constructor(private readonly pages: PagesRepository) {
		super();
	}

	async execute({ path }: Options): Promise<Result> {
		let parentId: PageId | undefined;

		for (const segment of path) {
			const children = await this.pages.listChildren(parentId);
			const match = children.find(
				(child) =>
					child.name.toLocaleLowerCase() === segment.trim().toLocaleLowerCase(),
			);

			if (match === undefined) {
				throw new FolderPathNotFoundError(path);
			}

			parentId = match.id;
		}

		if (parentId === undefined) {
			throw new FolderPathNotFoundError(path);
		}

		return { folderId: parentId };
	}
}
