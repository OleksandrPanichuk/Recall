import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type { Command, UseCase } from "@/application/use-case";
import {
	assertPlacement,
	createFolder,
	type FolderId,
	MAX_FOLDER_DEPTH,
	toFolderId,
} from "@/domain/folder/folder";
import {
	FolderDepthError,
	FolderValidationError,
} from "@/domain/folder/folder.errors";
import { type FolderDependencies, parentChain } from "./create-folder";

export interface EnsureFolderPathCommand {
	readonly path: readonly string[];
}

export interface EnsureFolderPathResult {
	readonly folderId: FolderId;
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

		if (segments.length > MAX_FOLDER_DEPTH) {
			throw new FolderDepthError(segments.length, MAX_FOLDER_DEPTH);
		}

		return this.unitOfWork.run(async ({ pages }) => {
			const created: string[] = [];
			let parentId: FolderId | undefined;

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

				const folder = createFolder({
					id: toFolderId(this.idGenerator.generate()),
					name: segment,
					parentId,
					createdAt: this.clock.now(),
				});

				assertPlacement(folder, await parentChain(pages, parentId), siblings);
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
