import type { FolderRepository } from "@/application/ports/repositories/folder.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { FolderId } from "@/domain/folder/folder";

export class FolderPathNotFoundError extends Error {
	readonly path: readonly string[];

	constructor(path: readonly string[]) {
		super(`No folder at "${path.join(" / ")}"`);
		this.name = "FolderPathNotFoundError";
		this.path = path;
	}
}

export interface ResolveFolderPathCommand {
	readonly path: readonly string[];
}

export interface ResolveFolderPathResult {
	readonly folderId: FolderId;
}

export interface ResolveFolderPathDependencies {
	readonly folders: FolderRepository;
}

export class ResolveFolderPathUseCase
	implements UseCase<Command<ResolveFolderPathCommand>, ResolveFolderPathResult>
{
	private readonly folders: FolderRepository;

	constructor(dependencies: ResolveFolderPathDependencies) {
		this.folders = dependencies.folders;
	}

	async execute(
		request: Command<ResolveFolderPathCommand>,
	): Promise<ResolveFolderPathResult> {
		let parentId: FolderId | undefined;

		for (const segment of request.path) {
			const match = this.folders
				.listChildren(parentId)
				.find(
					(child) =>
						child.name.toLocaleLowerCase() ===
						segment.trim().toLocaleLowerCase(),
				);

			if (match === undefined) {
				throw new FolderPathNotFoundError(request.path);
			}

			parentId = match.id;
		}

		if (parentId === undefined) {
			throw new FolderPathNotFoundError(request.path);
		}

		return { folderId: parentId };
	}
}
