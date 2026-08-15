import {
	createTestContext,
	type TestContext,
} from "@tests/fixtures/application.fixture";
import type { FolderId } from "@/domain/folder/folder";
import { CreateFolder } from "./create-folder";
import { DeleteFolder } from "./delete-folder";
import { EnsureFolderPath } from "./ensure-folder-path";
import { ListFolderTree } from "./list-folder-tree";
import { MoveFolder } from "./move-folder";
import { RenameFolder } from "./rename-folder";
import { ResolveFolderPath } from "./resolve-folder-path";

export interface FoldersHarness {
	readonly context: TestContext;
	readonly renameFolder: RenameFolder;
	readonly moveFolder: MoveFolder;
	readonly deleteFolder: DeleteFolder;
	readonly ensureFolderPath: EnsureFolderPath;
	readonly resolveFolderPath: ResolveFolderPath;
	readonly listFolderTree: ListFolderTree;
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

	const createFolder = new CreateFolder(dependencies);

	const create = async (name: string, parentId?: FolderId): Promise<FolderId> =>
		(await createFolder.execute({ name, parentId })).folderId;

	return {
		context,
		renameFolder: new RenameFolder(dependencies),
		moveFolder: new MoveFolder(dependencies),
		deleteFolder: new DeleteFolder(dependencies),
		ensureFolderPath: new EnsureFolderPath(dependencies),
		resolveFolderPath: new ResolveFolderPath(dependencies),
		listFolderTree: new ListFolderTree(dependencies),

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
