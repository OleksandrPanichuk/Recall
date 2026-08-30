import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Inject,
	Post,
	Req,
	Res,
	UseGuards,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import {
	APP_ROUTE_PREFIX,
	abandonAttemptCommandSchema,
	answerCommandSchema,
	attemptDetailCommandSchema,
	BOT_ROUTES,
	browseCommandSchema,
	createPageCommandSchema,
	deletePageCommandSchema,
	dueRepetitionsCommandSchema,
	finishCommandSchema,
	insightsCommandSchema,
	leechesCommandSchema,
	movePageCommandSchema,
	practiceCommandSchema,
	renamePageCommandSchema,
	resolveSettingsCommandSchema,
	searchPagesCommandSchema,
	setPageIconCommandSchema,
	startAttemptCommandSchema,
	statisticsCommandSchema,
	updateSettingsCommandSchema,
	writeSummaryCommandSchema,
} from "@recall/contracts";
import type { Response } from "express";
import type { OwnerId } from "@/application/ports/owner";
import type { UseCases } from "@/composition/create-application";
import { toFolderId } from "@/domain/folder/folder";
import { toQuizAttemptId } from "@/domain/quiz-attempt/quiz-attempt";
import { toQuestionId } from "@/domain/quiz-set/question";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { parseBody } from "../bot/parse-body";
import {
	answerResultToWire,
	attemptDetailToWire,
	browseViewToWire,
	currentQuestionToWire,
	dueSetToWire,
	finishResultToWire,
	insightsToWire,
	leechToWire,
	pageTreeNodeToWire,
	practiceResultToWire,
	resolvedSettingsToWire,
	settingsToWire,
	startResultToWire,
	statisticsToWire,
} from "../bot/wire";
import { USE_CASES_FOR } from "../shared/database/tokens";
import type { UseCasesFor } from "../shared/database/use-cases-for";
import { SessionGuard, type SessionRequest } from "./session.guard";

@ApiExcludeController()
@UseGuards(SessionGuard)
@Controller(APP_ROUTE_PREFIX)
export class AppSurfaceController {
	constructor(
		@Inject(USE_CASES_FOR) private readonly useCasesFor: UseCasesFor,
	) {}

	private of(request: SessionRequest): UseCases {
		const owner = request.owner as OwnerId;

		return this.useCasesFor(owner);
	}

	@Post(BOT_ROUTES.browse)
	@HttpCode(HttpStatus.OK)
	async browse(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(browseCommandSchema, body);

		return browseViewToWire(
			await this.of(request).browseFolder.execute({
				folderId:
					command.folderId === undefined
						? undefined
						: toFolderId(command.folderId),
			}),
		);
	}

	@Post(BOT_ROUTES.writeSummary)
	@HttpCode(HttpStatus.OK)
	async summary(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(writeSummaryCommandSchema, body);
		const written = await this.of(request).writeSummary.execute({
			folderId: toFolderId(command.folderId),
			summary: command.summary,
			append: command.append,
		});

		return { ...written, folderId: String(written.folderId) };
	}

	@Post(BOT_ROUTES.searchPages)
	@HttpCode(HttpStatus.OK)
	async search(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(searchPagesCommandSchema, body);
		const matches = await this.of(request).searchPages.execute(command);

		return matches.map((match) => ({
			folderId: String(match.id),
			name: match.name,
			excerpt: match.excerpt,
		}));
	}

	@Post(BOT_ROUTES.createPage)
	@HttpCode(HttpStatus.OK)
	async createPage(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(createPageCommandSchema, body);
		const created = await this.of(request).createFolder.execute({
			name: command.name,
			parentId:
				command.parentId === undefined
					? undefined
					: toFolderId(command.parentId),
		});

		return { folderId: String(created.folderId) };
	}

	@Post(BOT_ROUTES.renamePage)
	@HttpCode(HttpStatus.NO_CONTENT)
	async renamePage(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(renamePageCommandSchema, body);

		await this.of(request).renameFolder.execute({
			folderId: toFolderId(command.folderId),
			name: command.name,
		});
	}

	@Post(BOT_ROUTES.setPageIcon)
	@HttpCode(HttpStatus.NO_CONTENT)
	async setPageIcon(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(setPageIconCommandSchema, body);

		await this.of(request).setPageIcon.execute({
			folderId: toFolderId(command.folderId),
			icon: command.icon,
		});
	}

	@Post(BOT_ROUTES.deletePage)
	@HttpCode(HttpStatus.NO_CONTENT)
	async deletePage(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(deletePageCommandSchema, body);

		await this.of(request).deleteFolder.execute({
			folderId: toFolderId(command.folderId),
		});
	}

	@Post(BOT_ROUTES.movePage)
	@HttpCode(HttpStatus.NO_CONTENT)
	async movePage(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(movePageCommandSchema, body);

		await this.of(request).moveFolder.execute({
			folderId: toFolderId(command.folderId),
			parentId:
				command.parentId === undefined
					? undefined
					: toFolderId(command.parentId),
		});
	}

	@Post(BOT_ROUTES.pageTree)
	@HttpCode(HttpStatus.OK)
	async pageTree(@Req() request: SessionRequest) {
		const nodes = await this.of(request).listFolderTree.execute({});

		return nodes.map(pageTreeNodeToWire);
	}

	@Post(BOT_ROUTES.insights)
	@HttpCode(HttpStatus.OK)
	async insights(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(insightsCommandSchema, body);

		return insightsToWire(await this.of(request).getInsights.execute(command));
	}

	@Post(BOT_ROUTES.startAttempt)
	@HttpCode(HttpStatus.OK)
	async start(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(startAttemptCommandSchema, body);

		return startResultToWire(
			await this.of(request).startQuizAttempt.execute({
				...command,
				quizSetId: toQuizSetId(command.quizSetId),
			}),
		);
	}

	@Post(BOT_ROUTES.practice)
	@HttpCode(HttpStatus.OK)
	async practice(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(practiceCommandSchema, body);

		return practiceResultToWire(
			await this.of(request).startPracticeSession.execute({
				...command,
				quizSetId: toQuizSetId(command.quizSetId),
			}),
		);
	}

	@Post(BOT_ROUTES.currentQuestion)
	async current(@Req() request: SessionRequest, @Res() response: Response) {
		const view = await this.of(request).getCurrentQuestion.execute({});

		if (view === undefined) {
			response.status(HttpStatus.NO_CONTENT).send();

			return;
		}

		response.status(HttpStatus.OK).json(currentQuestionToWire(view));
	}

	@Post(BOT_ROUTES.answer)
	@HttpCode(HttpStatus.OK)
	async answer(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(answerCommandSchema, body);

		return answerResultToWire(
			await this.of(request).answerQuestion.execute({
				...command,
				questionId: toQuestionId(command.questionId),
			}),
		);
	}

	@Post(BOT_ROUTES.finish)
	@HttpCode(HttpStatus.OK)
	async finish(@Req() request: SessionRequest, @Body() body: unknown) {
		parseBody(finishCommandSchema, body);

		return finishResultToWire(
			await this.of(request).finishQuizAttempt.execute({}),
		);
	}

	@Post(BOT_ROUTES.abandon)
	@HttpCode(HttpStatus.OK)
	async abandon(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(abandonAttemptCommandSchema, body);

		return this.of(request).abandonQuizAttempt.execute({
			attemptId:
				command.attemptId === undefined
					? undefined
					: toQuizAttemptId(command.attemptId),
		});
	}

	@Post(BOT_ROUTES.statistics)
	@HttpCode(HttpStatus.OK)
	async statistics(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(statisticsCommandSchema, body);

		return statisticsToWire(
			await this.of(request).getQuizStatistics.execute({
				quizSetId: toQuizSetId(command.quizSetId),
			}),
		);
	}

	@Post(BOT_ROUTES.attemptDetail)
	@HttpCode(HttpStatus.OK)
	async attemptDetail(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(attemptDetailCommandSchema, body);

		return attemptDetailToWire(
			await this.of(request).getAttemptDetail.execute({
				attemptId: toQuizAttemptId(command.attemptId),
			}),
		);
	}

	@Post(BOT_ROUTES.dueRepetitions)
	@HttpCode(HttpStatus.OK)
	async due(@Req() request: SessionRequest, @Body() body: unknown) {
		parseBody(dueRepetitionsCommandSchema, body);

		const due = await this.of(request).listDueRepetitions.execute({});

		return due.map(dueSetToWire);
	}

	@Post(BOT_ROUTES.leeches)
	@HttpCode(HttpStatus.OK)
	async leeches(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(leechesCommandSchema, body);
		const leeches = await this.of(request).listLeeches.execute(command);

		return leeches.map(leechToWire);
	}

	@Post(BOT_ROUTES.resolveSettings)
	@HttpCode(HttpStatus.OK)
	async resolveSettings(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(resolveSettingsCommandSchema, body);

		return resolvedSettingsToWire(
			await this.of(request).resolveQuizSettings.execute({
				quizSetId:
					command.quizSetId === undefined
						? undefined
						: toQuizSetId(command.quizSetId),
			}),
		);
	}

	@Post(BOT_ROUTES.updateSettings)
	@HttpCode(HttpStatus.OK)
	async updateSettings(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(updateSettingsCommandSchema, body);

		return settingsToWire(
			await this.of(request).updateQuizSettings.execute({
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
