import {
	createTestContext,
	type TestContext,
} from "@tests/fixtures/application.fixture";
import type { FolderId } from "@/domain/folder/folder";
import { CreateFolderUseCase } from "./create-folder";
import { DeleteFolderUseCase } from "./delete-folder";
import { EnsureFolderPathUseCase } from "./ensure-folder-path";
import { ListFolderTreeUseCase } from "./list-folder-tree";
import { MoveFolderUseCase } from "./move-folder";
import { RenameFolderUseCase } from "./rename-folder";
import { ResolveFolderPathUseCase } from "./resolve-folder-path";

export interface FoldersHarness {
	readonly context: TestContext;
	readonly renameFolder: RenameFolderUseCase;
	readonly moveFolder: MoveFolderUseCase;
	readonly deleteFolder: DeleteFolderUseCase;
	readonly ensureFolderPath: EnsureFolderPathUseCase;
	readonly resolveFolderPath: ResolveFolderPathUseCase;
	readonly listFolderTree: ListFolderTreeUseCase;
	create(name: string, parentId?: FolderId): Promise<FolderId>;
	chain(...names: readonly string[]): Promise<FolderId>;
	nameOf(id: FolderId): string | undefined;
}

export function createFoldersHarness(): FoldersHarness {
	const context = createTestContext();

	const dependencies = {
		folders: context.folders,
		clock: context.clock,
		idGenerator: context.idGenerator,
		transaction: context.transaction,
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

		nameOf: (id) => context.folders.findById(id)?.name,
	};
}
