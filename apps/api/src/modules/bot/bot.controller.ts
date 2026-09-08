import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Inject,
	Post,
	Res,
	UseGuards,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import {
	abandonAttemptCommandSchema,
	answerCommandSchema,
	attachQuizCommandSchema,
	attemptDetailCommandSchema,
	BOT_ROUTES,
	browseCommandSchema,
	createPageCommandSchema,
	currentQuestionCommandSchema,
	deletePageCommandSchema,
	detachQuizCommandSchema,
	dueRepetitionsCommandSchema,
	finishCommandSchema,
	insightsCommandSchema,
	issueApiTokenCommandSchema,
	leechesCommandSchema,
	listApiTokensCommandSchema,
	listRevisionsCommandSchema,
	loginLinkCommandSchema,
	movePageCommandSchema,
	pauseAttemptCommandSchema,
	practiceCommandSchema,
	rateRecallCommandSchema,
	renamePageCommandSchema,
	reorderPageCommandSchema,
	resolveSettingsCommandSchema,
	revokeApiTokenCommandSchema,
	searchPagesCommandSchema,
	setPageIconCommandSchema,
	startAttemptCommandSchema,
	statisticsCommandSchema,
	updateSettingsCommandSchema,
	writeSummaryCommandSchema,
} from "@recall/contracts";
import type { Response } from "express";
import { ApiTokensService } from "@/modules/api-tokens";
import {
	AbandonQuizAttemptUseCase,
	AnswerQuestionUseCase,
	FinishQuizAttemptUseCase,
	GetCurrentQuestionUseCase,
	PauseQuizAttemptUseCase,
	RateRecallUseCase,
	ResumeQuizAttemptUseCase,
	StartQuizAttemptUseCase,
	toQuizAttemptId,
} from "@/modules/attempts";
import { BotTokenGuard } from "@/modules/auth";
import { GetInsightsUseCase } from "@/modules/insights";
import {
	AttachQuizUseCase,
	BrowseFolderUseCase,
	CreatePageUseCase,
	DeletePageUseCase,
	DetachQuizUseCase,
	detachedQuizToWire,
	ListPageRevisionsUseCase,
	ListPageTreeUseCase,
	MovePageUseCase,
	pageTreeNodeToWire,
	RenamePageUseCase,
	ReorderPageUseCase,
	revisionToWire,
	SearchPagesUseCase,
	SetPageIconUseCase,
	toPageId,
	WriteSummaryUseCase,
} from "@/modules/pages";
import { StartPracticeSessionUseCase } from "@/modules/practice";
import { toQuestionId, toQuizSetId } from "@/modules/quizzes";
import {
	ListDueRepetitionsUseCase,
	ListLeechesUseCase,
} from "@/modules/scheduling";
import {
	GetAttemptDetailUseCase,
	GetQuizStatisticsUseCase,
} from "@/modules/statistics";
import {
	ResolveQuizSettingsUseCase,
	UpdateQuizSettingsUseCase,
} from "@/modules/study-settings";
import { IssueLoginLinkUseCase } from "@/modules/telegram-link";
import { parseBody } from "./parse-body";
import {
	answerResultToWire,
	attachedQuizToWire,
	attemptDetailToWire,
	browseViewToWire,
	currentQuestionToWire,
	dueSetToWire,
	finishResultToWire,
	insightsToWire,
	leechToWire,
	practiceResultToWire,
	resolvedSettingsToWire,
	resumedAttemptToWire,
	settingsToWire,
	startResultToWire,
	statisticsToWire,
} from "./wire";

@ApiExcludeController()
@UseGuards(BotTokenGuard)
@Controller("bot")
export class BotController {
	constructor(
		@Inject(IssueLoginLinkUseCase)
		private readonly issueLoginLink: IssueLoginLinkUseCase,
		@Inject(ApiTokensService)
		private readonly tokens: ApiTokensService,
		@Inject(BrowseFolderUseCase)
		private readonly browseFolder: BrowseFolderUseCase,
		@Inject(WriteSummaryUseCase)
		private readonly writeSummary: WriteSummaryUseCase,
		@Inject(SearchPagesUseCase)
		private readonly searchPages: SearchPagesUseCase,
		@Inject(GetInsightsUseCase)
		private readonly getInsights: GetInsightsUseCase,
		@Inject(AbandonQuizAttemptUseCase)
		private readonly abandonQuizAttempt: AbandonQuizAttemptUseCase,
		@Inject(RateRecallUseCase)
		private readonly recall: RateRecallUseCase,
		@Inject(PauseQuizAttemptUseCase)
		private readonly pauseQuizAttempt: PauseQuizAttemptUseCase,
		@Inject(ResumeQuizAttemptUseCase)
		private readonly resumeQuizAttempt: ResumeQuizAttemptUseCase,
		@Inject(CreatePageUseCase)
		private readonly createFolder: CreatePageUseCase,
		@Inject(RenamePageUseCase)
		private readonly renameFolder: RenamePageUseCase,
		@Inject(SetPageIconUseCase)
		private readonly setIcon: SetPageIconUseCase,
		@Inject(DeletePageUseCase)
		private readonly deleteFolder: DeletePageUseCase,
		@Inject(ListPageTreeUseCase)
		private readonly listFolderTree: ListPageTreeUseCase,
		@Inject(MovePageUseCase)
		private readonly moveFolder: MovePageUseCase,
		@Inject(ListPageRevisionsUseCase)
		private readonly revisions: ListPageRevisionsUseCase,
		@Inject(ReorderPageUseCase)
		private readonly reorderFolder: ReorderPageUseCase,
		@Inject(AttachQuizUseCase)
		private readonly attachQuizSet: AttachQuizUseCase,
		@Inject(DetachQuizUseCase)
		private readonly detachQuizSet: DetachQuizUseCase,
		@Inject(StartQuizAttemptUseCase)
		private readonly startQuizAttempt: StartQuizAttemptUseCase,
		@Inject(StartPracticeSessionUseCase)
		private readonly startPracticeSession: StartPracticeSessionUseCase,
		@Inject(GetCurrentQuestionUseCase)
		private readonly getCurrentQuestion: GetCurrentQuestionUseCase,
		@Inject(AnswerQuestionUseCase)
		private readonly answerQuestion: AnswerQuestionUseCase,
		@Inject(FinishQuizAttemptUseCase)
		private readonly finishQuizAttempt: FinishQuizAttemptUseCase,
		@Inject(GetQuizStatisticsUseCase)
		private readonly getQuizStatistics: GetQuizStatisticsUseCase,
		@Inject(GetAttemptDetailUseCase)
		private readonly getAttemptDetail: GetAttemptDetailUseCase,
		@Inject(ListDueRepetitionsUseCase)
		private readonly listDueRepetitions: ListDueRepetitionsUseCase,
		@Inject(ListLeechesUseCase)
		private readonly listLeeches: ListLeechesUseCase,
		@Inject(ResolveQuizSettingsUseCase)
		private readonly resolveQuizSettings: ResolveQuizSettingsUseCase,
		@Inject(UpdateQuizSettingsUseCase)
		private readonly updateQuizSettings: UpdateQuizSettingsUseCase,
	) {}

	@Post(BOT_ROUTES.loginLink)
	@HttpCode(HttpStatus.OK)
	async loginLink(@Body() body: unknown) {
		const command = parseBody(loginLinkCommandSchema, body);
		const link = await this.issueLoginLink.execute({
			telegramUserId: command.telegramUserId,
			displayName: command.displayName,
		});

		return { url: link.url, expiresAt: link.expiresAt.toISOString() };
	}

	@Post(BOT_ROUTES.issueApiToken)
	@HttpCode(HttpStatus.OK)
	async issueApiToken(@Body() body: unknown) {
		const command = parseBody(issueApiTokenCommandSchema, body);
		const issued = await this.tokens.issue(
			await this.tokens.ownerForTelegram(command.telegramUserId),
			{
				name: command.name,
				expiresInDays: command.expiresInDays,
			},
		);

		return {
			id: issued.id,
			name: issued.name,
			token: issued.token,
			expiresAt: issued.expiresAt?.toISOString(),
		};
	}

	@Post(BOT_ROUTES.listApiTokens)
	@HttpCode(HttpStatus.OK)
	async listApiTokens(@Body() body: unknown) {
		const command = parseBody(listApiTokensCommandSchema, body);
		const tokens = await this.tokens.list(
			await this.tokens.ownerForTelegram(command.telegramUserId),
		);

		return tokens.map((token) => ({
			id: token.id,
			name: token.name,
			scopes: [...token.scopes],
			lastUsedAt: token.lastUsedAt?.toISOString(),
			expiresAt: token.expiresAt?.toISOString(),
			createdAt: token.createdAt.toISOString(),
		}));
	}

	@Post(BOT_ROUTES.revokeApiToken)
	@HttpCode(HttpStatus.OK)
	async revokeApiToken(@Body() body: unknown) {
		const command = parseBody(revokeApiTokenCommandSchema, body);

		return {
			revoked: await this.tokens.revoke(
				await this.tokens.ownerForTelegram(command.telegramUserId),
				command.tokenId,
			),
		};
	}

	@Post(BOT_ROUTES.browse)
	@HttpCode(HttpStatus.OK)
	async browse(@Body() body: unknown) {
		const command = parseBody(browseCommandSchema, body);

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
		const command = parseBody(writeSummaryCommandSchema, body);
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
		const command = parseBody(searchPagesCommandSchema, body);
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
		const command = parseBody(createPageCommandSchema, body);
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
		const command = parseBody(renamePageCommandSchema, body);

		await this.renameFolder.execute({
			folderId: toPageId(command.folderId),
			name: command.name,
		});
	}

	@Post(BOT_ROUTES.setPageIcon)
	@HttpCode(HttpStatus.NO_CONTENT)
	async setPageIcon(@Body() body: unknown) {
		const command = parseBody(setPageIconCommandSchema, body);

		await this.setIcon.execute({
			folderId: toPageId(command.folderId),
			icon: command.icon,
		});
	}

	@Post(BOT_ROUTES.deletePage)
	@HttpCode(HttpStatus.NO_CONTENT)
	async deletePage(@Body() body: unknown) {
		const command = parseBody(deletePageCommandSchema, body);

		await this.deleteFolder.execute({
			folderId: toPageId(command.folderId),
		});
	}

	@Post(BOT_ROUTES.reorderPage)
	@HttpCode(HttpStatus.NO_CONTENT)
	async reorderPage(@Body() body: unknown) {
		const command = parseBody(reorderPageCommandSchema, body);

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
		const command = parseBody(attachQuizCommandSchema, body);

		const attached = await this.attachQuizSet.execute({
			folderId: toPageId(command.folderId),
			quizSetId: toQuizSetId(command.quizSetId),
		});

		return attachedQuizToWire(attached);
	}

	@Post(BOT_ROUTES.detachQuiz)
	@HttpCode(HttpStatus.OK)
	async detachQuiz(@Body() body: unknown) {
		const command = parseBody(detachQuizCommandSchema, body);

		const detached = await this.detachQuizSet.execute({
			folderId: toPageId(command.folderId),
			quizSetId: toQuizSetId(command.quizSetId),
		});

		return detachedQuizToWire(detached);
	}

	@Post(BOT_ROUTES.movePage)
	@HttpCode(HttpStatus.NO_CONTENT)
	async movePage(@Body() body: unknown) {
		const command = parseBody(movePageCommandSchema, body);

		await this.moveFolder.execute({
			folderId: toPageId(command.folderId),
			parentId:
				command.parentId === undefined ? undefined : toPageId(command.parentId),
		});
	}

	@Post(BOT_ROUTES.listRevisions)
	@HttpCode(HttpStatus.OK)
	async listRevisions(@Body() body: unknown) {
		const command = parseBody(listRevisionsCommandSchema, body);

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
		const nodes = await this.listFolderTree.execute();

		return nodes.map(pageTreeNodeToWire);
	}

	@Post(BOT_ROUTES.insights)
	@HttpCode(HttpStatus.OK)
	async insights(@Body() body: unknown) {
		const command = parseBody(insightsCommandSchema, body);

		return insightsToWire(await this.getInsights.execute(command));
	}

	@Post(BOT_ROUTES.startAttempt)
	@HttpCode(HttpStatus.OK)
	async start(@Body() body: unknown) {
		const command = parseBody(startAttemptCommandSchema, body);

		return startResultToWire(
			await this.startQuizAttempt.execute({
				...command,
				quizSetId: toQuizSetId(command.quizSetId),
			}),
		);
	}

	@Post(BOT_ROUTES.practice)
	@HttpCode(HttpStatus.OK)
	async practice(@Body() body: unknown) {
		const command = parseBody(practiceCommandSchema, body);

		return practiceResultToWire(
			await this.startPracticeSession.execute({
				...command,
				quizSetId: toQuizSetId(command.quizSetId),
			}),
		);
	}

	@Post(BOT_ROUTES.currentQuestion)
	async current(@Body() body: unknown, @Res() response: Response) {
		const command = parseBody(currentQuestionCommandSchema, body);
		const view = await this.getCurrentQuestion.execute(command);

		if (view === undefined) {
			response.status(HttpStatus.NO_CONTENT).send();

			return;
		}

		response.status(HttpStatus.OK).json(currentQuestionToWire(view));
	}

	@Post(BOT_ROUTES.answer)
	@HttpCode(HttpStatus.OK)
	async answer(@Body() body: unknown) {
		const command = parseBody(answerCommandSchema, body);

		return answerResultToWire(
			await this.answerQuestion.execute({
				...command,
				questionId: toQuestionId(command.questionId),
			}),
		);
	}

	@Post(BOT_ROUTES.finish)
	@HttpCode(HttpStatus.OK)
	async finish(@Body() body: unknown) {
		const command = parseBody(finishCommandSchema, body);

		return finishResultToWire(await this.finishQuizAttempt.execute(command));
	}

	@Post(BOT_ROUTES.rateRecall)
	@HttpCode(HttpStatus.NO_CONTENT)
	async rateRecall(@Body() body: unknown) {
		const command = parseBody(rateRecallCommandSchema, body);

		await this.recall.execute({
			questionId: toQuestionId(command.questionId),
			recall: command.recall,
		});
	}

	@Post(BOT_ROUTES.pause)
	@HttpCode(HttpStatus.NO_CONTENT)
	async pause(@Body() body: unknown) {
		parseBody(pauseAttemptCommandSchema, body);

		await this.pauseQuizAttempt.execute({});
	}

	@Post(BOT_ROUTES.resume)
	@HttpCode(HttpStatus.OK)
	async resume(@Body() body: unknown) {
		parseBody(pauseAttemptCommandSchema, body);

		return resumedAttemptToWire(await this.resumeQuizAttempt.execute({}));
	}

	@Post(BOT_ROUTES.abandon)
	@HttpCode(HttpStatus.OK)
	async abandon(@Body() body: unknown) {
		const command = parseBody(abandonAttemptCommandSchema, body);

		return this.abandonQuizAttempt.execute({
			attemptId:
				command.attemptId === undefined
					? undefined
					: toQuizAttemptId(command.attemptId),
		});
	}

	@Post(BOT_ROUTES.statistics)
	@HttpCode(HttpStatus.OK)
	async statistics(@Body() body: unknown) {
		const command = parseBody(statisticsCommandSchema, body);

		return statisticsToWire(
			await this.getQuizStatistics.execute({
				...command,
				quizSetId: toQuizSetId(command.quizSetId),
			}),
		);
	}

	@Post(BOT_ROUTES.attemptDetail)
	@HttpCode(HttpStatus.OK)
	async attemptDetail(@Body() body: unknown) {
		const command = parseBody(attemptDetailCommandSchema, body);

		return attemptDetailToWire(
			await this.getAttemptDetail.execute({
				...command,
				attemptId: toQuizAttemptId(command.attemptId),
			}),
		);
	}

	@Post(BOT_ROUTES.dueRepetitions)
	@HttpCode(HttpStatus.OK)
	async due(@Body() body: unknown) {
		const command = parseBody(dueRepetitionsCommandSchema, body);
		const due = await this.listDueRepetitions.execute(command);

		return due.map(dueSetToWire);
	}

	@Post(BOT_ROUTES.leeches)
	@HttpCode(HttpStatus.OK)
	async leeches(@Body() body: unknown) {
		const command = parseBody(leechesCommandSchema, body);
		const leeches = await this.listLeeches.execute(command);

		return leeches.map(leechToWire);
	}

	@Post(BOT_ROUTES.resolveSettings)
	@HttpCode(HttpStatus.OK)
	async resolveSettings(@Body() body: unknown) {
		const command = parseBody(resolveSettingsCommandSchema, body);

		return resolvedSettingsToWire(
			await this.resolveQuizSettings.execute({
				quizSetId:
					command.quizSetId === undefined
						? undefined
						: toQuizSetId(command.quizSetId),
			}),
		);
	}

	@Post(BOT_ROUTES.updateSettings)
	@HttpCode(HttpStatus.OK)
	async updateSettings(@Body() body: unknown) {
		const command = parseBody(updateSettingsCommandSchema, body);

		return settingsToWire(
			await this.updateQuizSettings.execute({
				...command,
				repetition:
					command.repetition === undefined
						? undefined
						: {
								scheduler: command.repetition.scheduler,
								intervalsDays: [...command.repetition.intervalsDays],
								maxIntervalDays: command.repetition.maxIntervalDays,
								maxRepetitions: command.repetition.maxRepetitions,
								desiredRetention: command.repetition.desiredRetention,
							},
				quizSetId:
					command.quizSetId === undefined
						? undefined
						: toQuizSetId(command.quizSetId),
			}),
		);
	}
}
