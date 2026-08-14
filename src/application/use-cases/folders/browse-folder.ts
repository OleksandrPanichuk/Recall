import type { FolderRepository } from "@/application/ports/repositories/folder.repository";
import type {
	QuizSetRepository,
	QuizSetSummary,
} from "@/application/ports/repositories/quiz-set.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { FolderId } from "@/domain/folder/folder";
import { QuizSetStatus } from "@/domain/quiz-set/quiz-set";
import { requireFolder } from "./create-folder";

export interface BrowseCrumb {
	readonly id: FolderId;
	readonly name: string;
}

export interface BrowseChild extends BrowseCrumb {
	readonly setCount: number;
}

export interface BrowseView {
	readonly folderId?: FolderId;
	readonly name?: string;
	readonly parentId?: FolderId;
	readonly breadcrumb: readonly BrowseCrumb[];
	readonly children: readonly BrowseChild[];
	readonly sets: readonly QuizSetSummary[];
}

export interface BrowseFolderCommand {
	readonly folderId?: FolderId;
}

export interface BrowseFolderDependencies {
	readonly folders: FolderRepository;
	readonly quizSets: QuizSetRepository;
}

const published = [QuizSetStatus.Published];

export class BrowseFolder
	implements UseCase<Command<BrowseFolderCommand>, BrowseView>
{
	private readonly folders: FolderRepository;
	private readonly quizSets: QuizSetRepository;

	constructor(dependencies: BrowseFolderDependencies) {
		this.folders = dependencies.folders;
		this.quizSets = dependencies.quizSets;
	}

	async execute(request: Command<BrowseFolderCommand>): Promise<BrowseView> {
		const current =
			request.folderId === undefined
				? undefined
				: requireFolder(this.folders, request.folderId);

		const children = this.folders
			.listChildren(request.folderId)
			.map((child) => ({
				id: child.id,
				name: child.name,
				setCount: this.folders.countSetsIn(child.id, published),
			}));

		return {
			folderId: current?.id,
			name: current?.name,
			parentId: current?.parentId,
			breadcrumb:
				current === undefined
					? []
					: this.folders
							.listAncestors(current.id)
							.map((folder) => ({ id: folder.id, name: folder.name })),
			children,
			sets: this.quizSets.list({
				statuses: published,
				folderId: current?.id ?? null,
			}),
		};
	}
}
