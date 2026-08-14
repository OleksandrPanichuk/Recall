import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { FolderRepository } from "@/application/ports/repositories/folder.repository";
import type { Transaction } from "@/application/ports/transaction";
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

export class EnsureFolderPath
	implements UseCase<Command<EnsureFolderPathCommand>, EnsureFolderPathResult>
{
	private readonly folders: FolderRepository;
	private readonly clock: Clock;
	private readonly idGenerator: IdGenerator;
	private readonly transaction: Transaction;

	constructor(dependencies: FolderDependencies) {
		this.folders = dependencies.folders;
		this.clock = dependencies.clock;
		this.idGenerator = dependencies.idGenerator;
		this.transaction = dependencies.transaction;
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

		return this.transaction.run(() => {
			const created: string[] = [];
			let parentId: FolderId | undefined;

			for (const segment of segments) {
				const siblings = this.folders.listChildren(parentId);
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

				assertPlacement(folder, parentChain(this.folders, parentId), siblings);
				this.folders.save(folder);
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
