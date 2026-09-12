import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Post,
	UseGuards,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { BOT_ROUTES } from "@recall/contracts";
import { SurfaceGuard } from "@/modules/auth";
import { parseBody } from "@/shared/http/parse-body";
import {
	attachQuizDto,
	browsePageDto,
	createPageDto,
	deletePageDto,
	detachQuizDto,
	listRevisionsDto,
	movePageDto,
	renamePageDto,
	reorderPageDto,
	searchPagesDto,
	setPageIconDto,
	writeSummaryDto,
} from "./dto";
import { toPageId } from "./page.entity";
import {
	attachedQuizToWire,
	browseViewToWire,
	detachedQuizToWire,
	pageTreeNodeToWire,
	revisionToWire,
} from "./page.model";
import { toLinkedQuizId } from "./page.quiz-link";
import {
	AttachQuizUseCase,
	BrowseFolderUseCase,
	CreatePageUseCase,
	DeletePageUseCase,
	DetachQuizUseCase,
	ListPageRevisionsUseCase,
	ListPageTreeUseCase,
	MovePageUseCase,
	RenamePageUseCase,
	ReorderPageUseCase,
	SearchPagesUseCase,
	SetPageIconUseCase,
	WriteSummaryUseCase,
} from "./use-cases";

@ApiExcludeController()
@UseGuards(SurfaceGuard)
@Controller(["bot", "app"])
export class PagesController {
	constructor(
		private readonly browseFolder: BrowseFolderUseCase,
		private readonly writeSummary: WriteSummaryUseCase,
		private readonly searchPages: SearchPagesUseCase,
		private readonly createFolder: CreatePageUseCase,
		private readonly renameFolder: RenamePageUseCase,
		private readonly setIcon: SetPageIconUseCase,
		private readonly deleteFolder: DeletePageUseCase,
		private readonly listFolderTree: ListPageTreeUseCase,
		private readonly moveFolder: MovePageUseCase,
		private readonly revisions: ListPageRevisionsUseCase,
		private readonly reorderFolder: ReorderPageUseCase,
		private readonly attachQuizSet: AttachQuizUseCase,
		private readonly detachQuizSet: DetachQuizUseCase,
	) {}

	@Post(BOT_ROUTES.browse)
	@HttpCode(HttpStatus.OK)
	async browse(@Body() body: unknown) {
		const command = parseBody(browsePageDto, body);

		return browseViewToWire(
			await this.browseFolder.execute({
				folderId:
					command.folderId === undefined
						? undefined
						: toPageId(command.folderId),
			}),
		);
	}

	@Post(BOT_ROUTES.writeSummary)
	@HttpCode(HttpStatus.OK)
	async summary(@Body() body: unknown) {
		const command = parseBody(writeSummaryDto, body);
		const written = await this.writeSummary.execute({
			folderId: toPageId(command.folderId),
			summary: command.summary,
			append: command.append,
		});

		return { ...written, folderId: String(written.folderId) };
	}

	@Post(BOT_ROUTES.searchPages)
	@HttpCode(HttpStatus.OK)
	async search(@Body() body: unknown) {
		const command = parseBody(searchPagesDto, body);
		const matches = await this.searchPages.execute(command);

		return matches.map((match) => ({
			folderId: String(match.id),
			name: match.name,
			excerpt: match.excerpt,
		}));
	}

	@Post(BOT_ROUTES.createPage)
	@HttpCode(HttpStatus.OK)
	async createPage(@Body() body: unknown) {
		const command = parseBody(createPageDto, body);
		const created = await this.createFolder.execute({
			name: command.name,
			parentId:
				command.parentId === undefined ? undefined : toPageId(command.parentId),
		});

		return { folderId: String(created.folderId) };
	}

	@Post(BOT_ROUTES.renamePage)
	@HttpCode(HttpStatus.NO_CONTENT)
	async renamePage(@Body() body: unknown) {
		const command = parseBody(renamePageDto, body);

		await this.renameFolder.execute({
			folderId: toPageId(command.folderId),
			name: command.name,
		});
	}

	@Post(BOT_ROUTES.setPageIcon)
	@HttpCode(HttpStatus.NO_CONTENT)
	async setPageIcon(@Body() body: unknown) {
		const command = parseBody(setPageIconDto, body);

		await this.setIcon.execute({
			folderId: toPageId(command.folderId),
			icon: command.icon,
		});
	}

	@Post(BOT_ROUTES.deletePage)
	@HttpCode(HttpStatus.NO_CONTENT)
	async deletePage(@Body() body: unknown) {
		const command = parseBody(deletePageDto, body);

		await this.deleteFolder.execute({ folderId: toPageId(command.folderId) });
	}

	@Post(BOT_ROUTES.reorderPage)
	@HttpCode(HttpStatus.NO_CONTENT)
	async reorderPage(@Body() body: unknown) {
		const command = parseBody(reorderPageDto, body);

		await this.reorderFolder.execute({
			folderId: toPageId(command.folderId),
			afterId:
				command.afterId === undefined ? undefined : toPageId(command.afterId),
			beforeId:
				command.beforeId === undefined ? undefined : toPageId(command.beforeId),
		});
	}

	@Post(BOT_ROUTES.attachQuiz)
	@HttpCode(HttpStatus.OK)
	async attachQuiz(@Body() body: unknown) {
		const command = parseBody(attachQuizDto, body);

		return attachedQuizToWire(
			await this.attachQuizSet.execute({
				folderId: toPageId(command.folderId),
				quizSetId: toLinkedQuizId(command.quizSetId),
			}),
		);
	}

	@Post(BOT_ROUTES.detachQuiz)
	@HttpCode(HttpStatus.OK)
	async detachQuiz(@Body() body: unknown) {
		const command = parseBody(detachQuizDto, body);

		return detachedQuizToWire(
			await this.detachQuizSet.execute({
				folderId: toPageId(command.folderId),
				quizSetId: toLinkedQuizId(command.quizSetId),
			}),
		);
	}

	@Post(BOT_ROUTES.movePage)
	@HttpCode(HttpStatus.NO_CONTENT)
	async movePage(@Body() body: unknown) {
		const command = parseBody(movePageDto, body);

		await this.moveFolder.execute({
			folderId: toPageId(command.folderId),
			parentId:
				command.parentId === undefined ? undefined : toPageId(command.parentId),
		});
	}

	@Post(BOT_ROUTES.listRevisions)
	@HttpCode(HttpStatus.OK)
	async listRevisions(@Body() body: unknown) {
		const command = parseBody(listRevisionsDto, body);

		return (
			await this.revisions.execute({
				folderId: toPageId(command.folderId),
				limit: command.limit,
			})
		).map(revisionToWire);
	}

	@Post(BOT_ROUTES.pageTree)
	@HttpCode(HttpStatus.OK)
	async pageTree() {
		return (await this.listFolderTree.execute()).map(pageTreeNodeToWire);
	}
}
