import {
	createMemoryContext,
	type MemoryContext,
} from "@tests/fixtures/memory.fixture";
import type { FolderId } from "@/domain/folder/folder";
import { BrowseFolderUseCase } from "./browse-folder";
import { CreateFolderUseCase } from "./create-folder";
import { DeleteFolderUseCase } from "./delete-folder";
import { EnsureFolderPathUseCase } from "./ensure-folder-path";
import { ListFolderTreeUseCase } from "./list-folder-tree";
import { MoveFolderUseCase } from "./move-folder";
import { RenameFolderUseCase } from "./rename-folder";
import { ResolveFolderPathUseCase } from "./resolve-folder-path";

export interface FoldersHarness {
	readonly context: MemoryContext;
	readonly renameFolder: RenameFolderUseCase;
	readonly moveFolder: MoveFolderUseCase;
	readonly deleteFolder: DeleteFolderUseCase;
	readonly ensureFolderPath: EnsureFolderPathUseCase;
	readonly resolveFolderPath: ResolveFolderPathUseCase;
	readonly listFolderTree: ListFolderTreeUseCase;
	readonly browseFolder: BrowseFolderUseCase;
	create(name: string, parentId?: FolderId): Promise<FolderId>;
	chain(...names: readonly string[]): Promise<FolderId>;
	nameOf(id: FolderId): Promise<string | undefined>;
}

export function createFoldersHarness(): FoldersHarness {
	const context = createMemoryContext();

	const dependencies = {
		unitOfWork: context.unitOfWork,
		scope: context.scope,
		clock: context.clock,
		idGenerator: context.idGenerator,
	};

	const createFolder = new CreateFolderUseCase(dependencies);

	const create = async (name: string, parentId?: FolderId): Promise<FolderId> =>
		(await createFolder.execute({ name, parentId })).folderId;

	return {
		context,
		renameFolder: new RenameFolderUseCase(dependencies),
		moveFolder: new MoveFolderUseCase(dependencies),
		deleteFolder: new DeleteFolderUseCase(dependencies),
		ensureFolderPath: new EnsureFolderPathUseCase(dependencies),
		resolveFolderPath: new ResolveFolderPathUseCase(dependencies),
		listFolderTree: new ListFolderTreeUseCase(dependencies),
		browseFolder: new BrowseFolderUseCase(dependencies),

		create,

		chain: async (...names) => {
			let parentId: FolderId | undefined;

			for (const name of names) {
				parentId = await create(name, parentId);
			}

			if (parentId === undefined) {
				throw new Error("chain needs at least one name");
			}

			return parentId;
		},

		nameOf: async (id) => (await context.scope.pages.findById(id))?.name,
	};
}
