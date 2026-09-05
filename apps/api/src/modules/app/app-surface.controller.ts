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
	addQuestionsCommandSchema,
	addVocabularyCommandSchema,
	answerCommandSchema,
	attemptDetailCommandSchema,
	BOT_ROUTES,
	browseCommandSchema,
	createPageCommandSchema,
	createSetCommandSchema,
	deletePageCommandSchema,
	deleteQuestionCommandSchema,
	dueRepetitionsCommandSchema,
	finishCommandSchema,
	insightsCommandSchema,
	issueOwnApiTokenCommandSchema,
	leechesCommandSchema,
	listOwnApiTokensCommandSchema,
	listRevisionsCommandSchema,
	listSetsCommandSchema,
	listVocabularyCommandSchema,
	movePageCommandSchema,
	moveSetCommandSchema,
	practiceCommandSchema,
	quizSetIdCommandSchema,
	renamePageCommandSchema,
	reorderPageCommandSchema,
	resolveSettingsCommandSchema,
	revokeOwnApiTokenCommandSchema,
	searchPagesCommandSchema,
	setPageIconCommandSchema,
	startAttemptCommandSchema,
	statisticsCommandSchema,
	updateQuestionCommandSchema,
	updateSetCommandSchema,
	updateSettingsCommandSchema,
	updateVocabularyCommandSchema,
	writeSummaryCommandSchema,
} from "@recall/contracts";
import type { Response } from "express";
import type { OwnerId } from "@/application/ports/owner";
import type { UseCases } from "@/composition/create-application";
import { toFolderId } from "@/domain/folder/folder";
import { toQuizAttemptId } from "@/domain/quiz-attempt/quiz-attempt";
import { toQuestionId } from "@/domain/quiz-set/question";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { toVocabularyItemId } from "@/domain/vocabulary/vocabulary-item";
import { ApiTokenService } from "@/modules/auth/api-token.service";
import {
	answerOptionsOf,
	toQuestionInput,
} from "@/modules/shared/authoring/question-input";
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
	quizDetailToWire,
	quizSummaryToWire,
	resolvedSettingsToWire,
	revisionToWire,
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
		@Inject(ApiTokenService) private readonly tokens: ApiTokenService,
	) {}

	private of(request: SessionRequest): UseCases {
		const owner = request.owner as OwnerId;

		return this.useCasesFor(owner);
	}

	@Post(BOT_ROUTES.issueApiToken)
	@HttpCode(HttpStatus.OK)
	async issueApiToken(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(issueOwnApiTokenCommandSchema, body);
		const issued = await this.tokens.issue(request.owner as OwnerId, {
			name: command.name,
			expiresInDays: command.expiresInDays,
		});

		return {
			id: issued.id,
			name: issued.name,
			token: issued.token,
			expiresAt: issued.expiresAt?.toISOString(),
		};
	}

	@Post(BOT_ROUTES.listApiTokens)
	@HttpCode(HttpStatus.OK)
	async listApiTokens(@Req() request: SessionRequest, @Body() body: unknown) {
		parseBody(listOwnApiTokensCommandSchema, body);

		return (await this.tokens.list(request.owner as OwnerId)).map((token) => ({
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
	async revokeApiToken(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(revokeOwnApiTokenCommandSchema, body);

		return {
			revoked: await this.tokens.revoke(
				request.owner as OwnerId,
				command.tokenId,
			),
		};
	}

	@Post(BOT_ROUTES.createQuizSet)
	@HttpCode(HttpStatus.OK)
	async createQuizSet(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(createSetCommandSchema, body);
		const { quizSetId } = await this.of(request).createQuizSet.execute({
			...command,
			folderId:
				command.folderId === undefined
					? undefined
					: toFolderId(command.folderId),
		});

		return { quizSetId: String(quizSetId) };
	}

	@Post(BOT_ROUTES.updateQuizSet)
	@HttpCode(HttpStatus.NO_CONTENT)
	async updateQuizSet(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(updateSetCommandSchema, body);

		await this.of(request).updateQuizSet.execute({
			...command,
			quizSetId: toQuizSetId(command.quizSetId),
		});
	}

	@Post(BOT_ROUTES.moveQuizSet)
	@HttpCode(HttpStatus.NO_CONTENT)
	async moveQuizSet(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(moveSetCommandSchema, body);

		await this.of(request).moveQuizSet.execute({
			quizSetId: toQuizSetId(command.quizSetId),
			folderId:
				command.folderId === undefined
					? undefined
					: toFolderId(command.folderId),
		});
	}

	@Post(BOT_ROUTES.publishQuizSet)
	@HttpCode(HttpStatus.NO_CONTENT)
	async publishQuizSet(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(quizSetIdCommandSchema, body);

		await this.of(request).publishQuizSet.execute({
			quizSetId: toQuizSetId(command.quizSetId),
		});
	}

	@Post(BOT_ROUTES.archiveQuizSet)
	@HttpCode(HttpStatus.NO_CONTENT)
	async archiveQuizSet(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(quizSetIdCommandSchema, body);

		await this.of(request).archiveQuizSet.execute({
			quizSetId: toQuizSetId(command.quizSetId),
		});
	}

	@Post(BOT_ROUTES.getQuizSet)
	@HttpCode(HttpStatus.OK)
	async getQuizSet(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(quizSetIdCommandSchema, body);

		return quizDetailToWire(
			await this.of(request).getQuizSet.execute({
				quizSetId: toQuizSetId(command.quizSetId),
			}),
		);
	}

	@Post(BOT_ROUTES.listQuizSets)
	@HttpCode(HttpStatus.OK)
	async listQuizSets(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(listSetsCommandSchema, body);

		return (await this.of(request).listQuizSets.execute(command)).map(
			quizSummaryToWire,
		);
	}

	@Post(BOT_ROUTES.addQuestions)
	@HttpCode(HttpStatus.OK)
	async addQuestions(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(addQuestionsCommandSchema, body);
		const result = await this.of(request).addQuestions.execute({
			quizSetId: toQuizSetId(command.quizSetId),
			questions: command.questions.map(toQuestionInput),
		});

		return {
			addedQuestionIds: result.addedQuestionIds.map(String),
			alreadyPresent: result.alreadyPresent,
		};
	}

	@Post(BOT_ROUTES.updateQuestion)
	@HttpCode(HttpStatus.NO_CONTENT)
	async updateQuestion(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(updateQuestionCommandSchema, body);

		await this.of(request).updateQuestion.execute({
			...command,
			quizSetId: toQuizSetId(command.quizSetId),
			questionId: toQuestionId(command.questionId),
			options: answerOptionsOf(command),
		});
	}

	@Post(BOT_ROUTES.deleteQuestion)
	@HttpCode(HttpStatus.OK)
	async deleteQuestion(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(deleteQuestionCommandSchema, body);
		const result = await this.of(request).deleteQuestion.execute({
			quizSetId: toQuizSetId(command.quizSetId),
			questionId: toQuestionId(command.questionId),
		});

		return {
			questionId: String(result.questionId),
			remaining: result.remaining,
		};
	}

	@Post(BOT_ROUTES.listVocabulary)
	@HttpCode(HttpStatus.OK)
	async listVocabulary(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(listVocabularyCommandSchema, body);

		return (
			await this.of(request).listVocabulary.execute({
				quizSetId: toQuizSetId(command.quizSetId),
			})
		).map((item) => ({
			itemId: String(item.itemId),
			terms: [...item.terms],
			translations: [...item.translations],
			transcription: item.transcription,
			example: item.example,
			topic: item.topic,
			questionIds: [...item.questionIds],
		}));
	}

	@Post(BOT_ROUTES.addVocabulary)
	@HttpCode(HttpStatus.OK)
	async addVocabulary(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(addVocabularyCommandSchema, body);
		const result = await this.of(request).addVocabulary.execute({
			...command,
			quizSetId: toQuizSetId(command.quizSetId),
		});

		return {
			itemIds: result.itemIds.map(String),
			addedQuestionCount: result.addedQuestionCount,
			alreadyPresent: result.alreadyPresent,
		};
	}

	@Post(BOT_ROUTES.updateVocabulary)
	@HttpCode(HttpStatus.OK)
	async updateVocabulary(
		@Req() request: SessionRequest,
		@Body() body: unknown,
	) {
		const command = parseBody(updateVocabularyCommandSchema, body);
		const result = await this.of(request).updateVocabulary.execute({
			...command,
			itemId: toVocabularyItemId(command.itemId),
		});

		return {
			itemId: String(result.itemId),
			rebuiltQuestionCount: result.rebuiltQuestionCount,
			removedQuestionCount: result.removedQuestionCount,
		};
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

	@Post(BOT_ROUTES.reorderPage)
	@HttpCode(HttpStatus.NO_CONTENT)
	async reorderPage(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(reorderPageCommandSchema, body);

		await this.of(request).reorderFolder.execute({
			folderId: toFolderId(command.folderId),
			afterId:
				command.afterId === undefined ? undefined : toFolderId(command.afterId),
			beforeId:
				command.beforeId === undefined
					? undefined
					: toFolderId(command.beforeId),
		});
	}

	@Post(BOT_ROUTES.listRevisions)
	@HttpCode(HttpStatus.OK)
	async listRevisions(@Req() request: SessionRequest, @Body() body: unknown) {
		const command = parseBody(listRevisionsCommandSchema, body);

		return (
			await this.of(request).listRevisions.execute({
				folderId: toFolderId(command.folderId),
				limit: command.limit,
			})
		).map(revisionToWire);
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
