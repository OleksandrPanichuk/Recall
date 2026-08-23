import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { QuizSummary } from "@/application/ports/repositories/quiz.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { FolderId } from "@/domain/folder/folder";
import { QuizSetStatus } from "@/domain/quiz-set/quiz-set";
import { requireFolder } from "./create-folder";

export interface BrowseCrumb {
	readonly id: FolderId;
	readonly name: string;
}

export interface BrowseChild extends BrowseCrumb {
	readonly itemCount: number;
}

export interface BrowseView {
	readonly folderId?: FolderId;
	readonly name?: string;
	readonly parentId?: FolderId;
	readonly breadcrumb: readonly BrowseCrumb[];
	readonly children: readonly BrowseChild[];
	readonly sets: readonly QuizSummary[];
}

export interface BrowseFolderCommand {
	readonly folderId?: FolderId;
}

export interface BrowseFolderDependencies {
	readonly scope: RepositoryScope;
}

const published = [QuizSetStatus.Published];

export class BrowseFolderUseCase
	implements UseCase<Command<BrowseFolderCommand>, BrowseView>
{
	private readonly scope: RepositoryScope;

	constructor(dependencies: BrowseFolderDependencies) {
		this.scope = dependencies.scope;
	}

	async execute(request: Command<BrowseFolderCommand>): Promise<BrowseView> {
		const { pages, quizzes } = this.scope;
		const current =
			request.folderId === undefined
				? undefined
				: await requireFolder(pages, request.folderId);

		const children: BrowseChild[] = [];

		for (const child of await pages.listChildren(request.folderId)) {
			children.push({
				id: child.id,
				name: child.name,
				itemCount:
					(await pages.countQuizzesIn(child.id, published)) +
					(await pages.countChildPages(child.id)),
			});
		}

		const ancestors =
			current === undefined ? [] : await pages.listAncestors(current.id);

		return {
			folderId: current?.id,
			name: current?.name,
			parentId: current?.parentId,
			breadcrumb: ancestors.map((folder) => ({
				id: folder.id,
				name: folder.name,
			})),
			children,
			sets: await quizzes.list({
				statuses: published,
				pageId: current?.id ?? null,
			}),
		};
	}
}
