import {
	CreatePageUseCase,
	DeletePageUseCase,
	EnsurePagePathUseCase,
	ListPageTreeUseCase,
	MovePageUseCase,
	type PageId,
	PagesService,
	RenamePageUseCase,
	ReorderPageUseCase,
	ResolvePagePathUseCase,
} from "@/modules/pages";
import { createMemoryContext, type MemoryContext } from "./memory.fixture";

export interface PagesHarness {
	readonly context: MemoryContext;
	readonly renamePage: RenamePageUseCase;
	readonly movePage: MovePageUseCase;
	readonly reorderPage: ReorderPageUseCase;
	readonly deletePage: DeletePageUseCase;
	readonly ensurePagePath: EnsurePagePathUseCase;
	readonly resolvePagePath: ResolvePagePathUseCase;
	readonly listPageTree: ListPageTreeUseCase;
	create(name: string, parentId?: PageId): Promise<PageId>;
	chain(...names: readonly string[]): Promise<PageId>;
	nameOf(id: PageId): Promise<string | undefined>;
}

export function createPagesHarness(): PagesHarness {
	const context = createMemoryContext();
	const pages = context.scope.pages;
	const service = new PagesService(pages);
	const { transaction, clock, idGenerator } = context;

	const createPage = new CreatePageUseCase(
		pages,
		service,
		transaction,
		clock,
		idGenerator,
	);

	const create = async (name: string, parentId?: PageId): Promise<PageId> =>
		(await createPage.execute({ name, parentId })).folderId;

	return {
		context,
		renamePage: new RenamePageUseCase(pages, service, transaction, clock),
		movePage: new MovePageUseCase(pages, service, transaction, clock),
		reorderPage: new ReorderPageUseCase(pages, service, transaction, clock),
		deletePage: new DeletePageUseCase(pages, service, transaction),
		ensurePagePath: new EnsurePagePathUseCase(
			pages,
			service,
			transaction,
			clock,
			idGenerator,
		),
		resolvePagePath: new ResolvePagePathUseCase(pages),
		listPageTree: new ListPageTreeUseCase(pages),

		create,

		chain: async (...names) => {
			let parentId: PageId | undefined;

			for (const name of names) {
				parentId = await create(name, parentId);
			}

			if (parentId === undefined) {
				throw new Error("chain needs at least one name");
			}

			return parentId;
		},

		nameOf: async (id) => (await pages.findById(id))?.name,
	};
}
