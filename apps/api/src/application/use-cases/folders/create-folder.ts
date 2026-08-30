import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type {
	PageRepository,
	RepositoryScope,
} from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type { Command, UseCase } from "@/application/use-case";
import {
	assertPlacement,
	createFolder,
	type Folder,
	type FolderId,
	toFolderId,
} from "@/domain/folder/folder";
import { positionBetween } from "@/domain/folder/ordering";

export class FolderNotFoundError extends Error {
	readonly folderId: FolderId;

	constructor(folderId: FolderId) {
		super(`Folder ${folderId} does not exist`);
		this.name = "FolderNotFoundError";
		this.folderId = folderId;
	}
}

export interface FolderDependencies {
	readonly unitOfWork: UnitOfWork<RepositoryScope>;
	readonly scope: RepositoryScope;
	readonly clock: Clock;
	readonly idGenerator: IdGenerator;
}

export async function requireFolder(
	pages: PageRepository,
	folderId: FolderId,
): Promise<Folder> {
	const folder = await pages.findById(folderId);

	if (folder === undefined) {
		throw new FolderNotFoundError(folderId);
	}

	return folder;
}

export async function parentChain(
	pages: PageRepository,
	parentId: FolderId | undefined,
): Promise<readonly Folder[]> {
	if (parentId === undefined) {
		return [];
	}

	const parent = await requireFolder(pages, parentId);

	return [...(await pages.listAncestors(parent.id)), parent];
}

export const lastPositionAmong = (siblings: readonly Folder[]): number =>
	positionBetween(
		siblings.length === 0
			? undefined
			: Math.max(...siblings.map((sibling) => sibling.position)),
		undefined,
	);

export interface CreateFolderCommand {
	readonly name: string;
	readonly parentId?: FolderId;
}

export interface CreateFolderResult {
	readonly folderId: FolderId;
}

export class CreateFolderUseCase
	implements UseCase<Command<CreateFolderCommand>, CreateFolderResult>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;
	private readonly idGenerator: IdGenerator;

	constructor(dependencies: FolderDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
		this.idGenerator = dependencies.idGenerator;
	}

	execute(request: Command<CreateFolderCommand>): Promise<CreateFolderResult> {
		return this.unitOfWork.run(async ({ pages }) => {
			const siblings = await pages.listChildren(request.parentId);
			const folder = createFolder({
				id: toFolderId(this.idGenerator.generate()),
				name: request.name,
				parentId: request.parentId,
				position: lastPositionAmong(siblings),
				createdAt: this.clock.now(),
			});

			assertPlacement(
				folder,
				await parentChain(pages, request.parentId),
				siblings,
			);
			await pages.save(folder);

			return { folderId: folder.id };
		});
	}
}
