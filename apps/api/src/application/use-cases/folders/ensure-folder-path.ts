import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type { Command, UseCase } from "@/application/use-case";
import {
	FolderDepthError,
	FolderValidationError,
	PageEntity,
	type PageId,
	toPageId,
} from "@/modules/pages";
import { type FolderDependencies, parentChain } from "./create-folder";

export interface EnsureFolderPathCommand {
	readonly path: readonly string[];
}

export interface EnsureFolderPathResult {
	readonly folderId: PageId;
	readonly created: readonly string[];
}

export class EnsureFolderPathUseCase
	implements UseCase<Command<EnsureFolderPathCommand>, EnsureFolderPathResult>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;
	private readonly idGenerator: IdGenerator;

	constructor(dependencies: FolderDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
		this.idGenerator = dependencies.idGenerator;
	}

	async execute(
		request: Command<EnsureFolderPathCommand>,
	): Promise<EnsureFolderPathResult> {
		const segments = request.path.map((segment) => segment.trim());

		if (segments.length === 0 || segments.some((s) => s.length === 0)) {
			throw new FolderValidationError(["path must not contain empty segments"]);
		}

		if (segments.length > PageEntity.MAX_DEPTH) {
			throw new FolderDepthError(segments.length, PageEntity.MAX_DEPTH);
		}

		return this.unitOfWork.run(async ({ pages }) => {
			const created: string[] = [];
			let parentId: PageId | undefined;

			for (const segment of segments) {
				const siblings = await pages.listChildren(parentId);
				const existing = siblings.find(
					(sibling) =>
						sibling.name.toLocaleLowerCase() === segment.toLocaleLowerCase(),
				);

				if (existing !== undefined) {
					parentId = existing.id;
					continue;
				}

				const folder = PageEntity.create({
					id: toPageId(this.idGenerator.generate()),
					name: segment,
					parentId,
					createdAt: this.clock.now(),
				});

				PageEntity.assertPlacement(
					folder,
					await parentChain(pages, parentId),
					siblings,
				);
				await pages.save(folder);
				created.push(folder.name);
				parentId = folder.id;
			}

			if (parentId === undefined) {
				throw new FolderValidationError(["path must not be empty"]);
			}

			return { folderId: parentId, created };
		});
	}
}
