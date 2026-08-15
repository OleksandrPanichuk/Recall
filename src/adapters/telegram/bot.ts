import { Telegraf } from "telegraf";
import type { AnswerQuestion } from "@/application/use-cases/attempts/answer-question";
import type { FinishQuizAttempt } from "@/application/use-cases/attempts/finish-quiz-attempt";
import type { GetCurrentQuestion } from "@/application/use-cases/attempts/get-current-question";
import type { StartQuizAttempt } from "@/application/use-cases/attempts/start-quiz-attempt";
import type { BrowseFolder } from "@/application/use-cases/folders/browse-folder";
import type { ListDueRepetitions } from "@/application/use-cases/repetition/list-due-repetitions";
import type { GetAttemptDetail } from "@/application/use-cases/statistics/get-attempt-detail";
import type { GetQuizStatistics } from "@/application/use-cases/statistics/get-quiz-statistics";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import type { Logger } from "@/infrastructure/logging/logger.types";
import { normaliseForComparison } from "@/shared/utils/text";
import { decodeCallback } from "./callbacks/callback-data";
import { CallbackAction } from "./callbacks/callback-data.constants";
import {
	answerHandler,
	revealHandler,
	toggleHandler,
	typedAnswerHandler,
} from "./handlers/answer-question.handler";
import { attemptDetailHandler } from "./handlers/attempt-detail.handler";
import { browseHandler } from "./handlers/browse.handler";
import { finishHandler } from "./handlers/finish-attempt.handler";
import { repetitionsHandler } from "./handlers/repetitions.handler";
import { menuHandler, resumeHandler } from "./handlers/start.handler";
import { startAttemptHandler } from "./handlers/start-attempt.handler";
import { statisticsHandler } from "./handlers/statistics.handler";
import { allowlistMiddleware } from "./middleware/allowlist.middleware";
import { errorMiddleware } from "./middleware/error.middleware";
import { loggingMiddleware } from "./middleware/logging.middleware";
import { notice, UNAVAILABLE_FEATURES } from "./presenters/menu.presenter";
import { render } from "./screen";

export interface TelegramUseCases {
	readonly browseFolder: BrowseFolder;
	readonly listDueRepetitions: ListDueRepetitions;
	readonly getAttemptDetail: GetAttemptDetail;
	readonly startQuizAttempt: StartQuizAttempt;
	readonly getCurrentQuestion: GetCurrentQuestion;
	readonly answerQuestion: AnswerQuestion;
	readonly finishQuizAttempt: FinishQuizAttempt;
	readonly getQuizStatistics: GetQuizStatistics;
}

export interface TelegramBotOptions {
	readonly token: string;
	readonly allowedTelegramUserId: number;
	readonly useCases: TelegramUseCases;
	readonly logger: Logger;
}

export function createBot(options: TelegramBotOptions): Telegraf {
	const bot = new Telegraf(options.token);
	const { useCases, logger } = options;

	bot.use(errorMiddleware(logger));
	bot.use(loggingMiddleware({ logger }));
	bot.use(
		allowlistMiddleware({
			allowedTelegramUserId: options.allowedTelegramUserId,
			logger,
		}),
	);

	bot.start(menuHandler(useCases));

	bot.on("callback_query", async (ctx) => {
		const query = ctx.callbackQuery;
		const data = "data" in query ? query.data : undefined;
		const callback = data === undefined ? undefined : decodeCallback(data);

		if (callback === undefined) {
			logger.warn("could not decode callback data", {
				telegramUserId: ctx.from.id,
				action: data?.split(":")[0],
				dataLength: data?.length,
			});
			await ctx.answerCbQuery("Незрозуміла дія").catch(() => {});

			return;
		}

		// Telegram spins the button until the query is answered. A replayed update
		// is past the ~10s answer window and 400s, which must not abort dispatch.
		await ctx.answerCbQuery().catch(() => {});

		const telegramUserId = ctx.from.id;

		switch (callback.action) {
			case CallbackAction.Menu:
				await menuHandler(useCases)(ctx);

				return;
			case CallbackAction.Sets:
				await browseHandler(useCases)(ctx, {
					action: CallbackAction.Browse,
					leaf: CallbackAction.StartSet,
				});

				return;
			case CallbackAction.AttemptDetail:
				await attemptDetailHandler(useCases)(ctx, callback);

				return;
			case CallbackAction.Repetitions:
				await repetitionsHandler(useCases)(ctx);

				return;
			case CallbackAction.Statistics:
				await browseHandler(useCases)(ctx, {
					action: CallbackAction.Browse,
					leaf: CallbackAction.StatisticsFor,
				});

				return;
			case CallbackAction.Browse:
				await browseHandler(useCases)(ctx, callback);

				return;
			case CallbackAction.StartSet:
				await startAttemptHandler(useCases)(ctx, {
					telegramUserId,
					quizSetId: toQuizSetId(callback.quizSetId),
				});

				return;
			case CallbackAction.StatisticsFor:
				await statisticsHandler(useCases)(ctx, {
					telegramUserId,
					quizSetId: toQuizSetId(callback.quizSetId),
				});

				return;
			case CallbackAction.Resume:
				await resumeHandler(useCases)(ctx);

				return;
			case CallbackAction.Toggle:
				await toggleHandler(useCases)(ctx, callback);

				return;
			case CallbackAction.Answer:
				await answerHandler(useCases)(ctx, callback);

				return;
			case CallbackAction.Reveal:
				await revealHandler(useCases)(ctx, callback);

				return;
			case CallbackAction.Finish:
				await finishHandler(useCases)(ctx);

				return;
			case CallbackAction.Unavailable:
				await render(
					ctx,
					notice(
						UNAVAILABLE_FEATURES[callback.feature] ??
							"Ця функція ще недоступна.",
					),
				);

				return;
		}
	});

	// A typed question is answered by sending a message, so text has to be
	// offered to the attempt before it falls through to the menu.
	bot.on("message", async (ctx) => {
		const text =
			"text" in ctx.message && typeof ctx.message.text === "string"
				? ctx.message.text.trim()
				: undefined;

		if (
			text !== undefined &&
			normaliseForComparison(text).length > 0 &&
			!text.startsWith("/") &&
			(await typedAnswerHandler(useCases)(ctx, text))
		) {
			return;
		}

		await menuHandler(useCases)(ctx);
	});

	bot.catch((error) => {
		logger.error("telegram update was dropped", { error });
	});

	return bot;
}
