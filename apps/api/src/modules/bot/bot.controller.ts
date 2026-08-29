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
	answerCommandSchema,
	attemptDetailCommandSchema,
	BOT_ROUTES,
	browseCommandSchema,
	currentQuestionCommandSchema,
	dueRepetitionsCommandSchema,
	finishCommandSchema,
	issueApiTokenCommandSchema,
	leechesCommandSchema,
	listApiTokensCommandSchema,
	loginLinkCommandSchema,
	practiceCommandSchema,
	resolveSettingsCommandSchema,
	revokeApiTokenCommandSchema,
	startAttemptCommandSchema,
	statisticsCommandSchema,
	updateSettingsCommandSchema,
} from "@recall/contracts";
import type { Response } from "express";
import { AnswerQuestionUseCase } from "@/application/use-cases/attempts/answer-question";
import { FinishQuizAttemptUseCase } from "@/application/use-cases/attempts/finish-quiz-attempt";
import { GetCurrentQuestionUseCase } from "@/application/use-cases/attempts/get-current-question";
import { StartQuizAttemptUseCase } from "@/application/use-cases/attempts/start-quiz-attempt";
import { BrowseFolderUseCase } from "@/application/use-cases/folders/browse-folder";
import { StartPracticeSessionUseCase } from "@/application/use-cases/practice/start-practice-session";
import { ListDueRepetitionsUseCase } from "@/application/use-cases/repetition/list-due-repetitions";
import { ListLeechesUseCase } from "@/application/use-cases/repetition/list-leeches";
import { ResolveQuizSettingsUseCase } from "@/application/use-cases/settings/resolve-quiz-settings";
import { UpdateQuizSettingsUseCase } from "@/application/use-cases/settings/update-quiz-settings";
import { GetAttemptDetailUseCase } from "@/application/use-cases/statistics/get-attempt-detail";
import { GetQuizStatisticsUseCase } from "@/application/use-cases/statistics/get-quiz-statistics";
import { toFolderId } from "@/domain/folder/folder";
import { toQuizAttemptId } from "@/domain/quiz-attempt/quiz-attempt";
import { toQuestionId } from "@/domain/quiz-set/question";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { ApiTokenService } from "../auth/api-token.service";
import { TelegramIdentityService } from "../auth/telegram-identity.service";
import { BotTokenGuard } from "./bot-token.guard";
import { parseBody } from "./parse-body";
import {
	answerResultToWire,
	attemptDetailToWire,
	browseViewToWire,
	currentQuestionToWire,
	dueSetToWire,
	finishResultToWire,
	leechToWire,
	practiceResultToWire,
	resolvedSettingsToWire,
	settingsToWire,
	startResultToWire,
	statisticsToWire,
} from "./wire";

@ApiExcludeController()
@UseGuards(BotTokenGuard)
@Controller("bot")
export class BotController {
	constructor(
		@Inject(TelegramIdentityService)
		private readonly identity: TelegramIdentityService,
		@Inject(ApiTokenService)
		private readonly tokens: ApiTokenService,
		@Inject(BrowseFolderUseCase)
		private readonly browseFolder: BrowseFolderUseCase,
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
		const link = await this.identity.issueLoginLink(
			command.telegramUserId,
			command.displayName,
		);

		return { url: link.url, expiresAt: link.expiresAt.toISOString() };
	}

	@Post(BOT_ROUTES.issueApiToken)
	@HttpCode(HttpStatus.OK)
	async issueApiToken(@Body() body: unknown) {
		const command = parseBody(issueApiTokenCommandSchema, body);
		const issued = await this.tokens.issue(command.telegramUserId, {
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
	async listApiTokens(@Body() body: unknown) {
		const command = parseBody(listApiTokensCommandSchema, body);
		const tokens = await this.tokens.list(command.telegramUserId);

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
				command.telegramUserId,
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
						: toFolderId(command.folderId),
			}),
		);
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
								intervalsDays: [...command.repetition.intervalsDays],
								maxIntervalDays: command.repetition.maxIntervalDays,
								maxRepetitions: command.repetition.maxRepetitions,
							},
				quizSetId:
					command.quizSetId === undefined
						? undefined
						: toQuizSetId(command.quizSetId),
			}),
		);
	}
}
