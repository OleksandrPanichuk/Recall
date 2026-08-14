import { Telegraf } from "telegraf";
import type { AnswerQuestion } from "@/application/use-cases/attempts/answer-question";
import type { FinishQuizAttempt } from "@/application/use-cases/attempts/finish-quiz-attempt";
import type { GetCurrentQuestion } from "@/application/use-cases/attempts/get-current-question";
import type { StartQuizAttempt } from "@/application/use-cases/attempts/start-quiz-attempt";
import type { ListQuizSets } from "@/application/use-cases/quiz-sets/list-quiz-sets";
import type { GetQuizStatistics } from "@/application/use-cases/statistics/get-quiz-statistics";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { CallbackAction, decodeCallback } from "./callbacks/callback-data";
import {
	answerHandler,
	toggleHandler,
} from "./handlers/answer-question.handler";
import { finishHandler } from "./handlers/finish-attempt.handler";
import { quizSetListHandler } from "./handlers/quiz-set-list.handler";
import { menuHandler, resumeHandler } from "./handlers/start.handler";
import { startAttemptHandler } from "./handlers/start-attempt.handler";
import { statisticsHandler } from "./handlers/statistics.handler";
import { allowlistMiddleware } from "./middleware/allowlist.middleware";
import { errorMiddleware } from "./middleware/error.middleware";
import { notice, UNAVAILABLE_FEATURES } from "./presenters/menu.presenter";
import { render } from "./screen";

export interface TelegramUseCases {
	readonly listQuizSets: ListQuizSets;
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
	readonly log?: (error: unknown) => void;
}

export function createBot(options: TelegramBotOptions): Telegraf {
	const bot = new Telegraf(options.token);
	const { useCases } = options;

	bot.use(errorMiddleware(options.log));
	bot.use(allowlistMiddleware(options.allowedTelegramUserId));

	bot.start(menuHandler(useCases));

	bot.on("callback_query", async (ctx) => {
		const query = ctx.callbackQuery;
		const data = "data" in query ? query.data : undefined;
		const callback = data === undefined ? undefined : decodeCallback(data);

		if (callback === undefined) {
			await ctx.answerCbQuery("Незрозуміла дія").catch(() => {});

			return;
		}

		// Acknowledge before doing the work: Telegram shows a spinner on the button
		// until the callback is answered, and the work may write to the database.
		// A replayed update from before a restart is already past the ~10 second
		// answer window, so this 400s — which must not abort the dispatch.
		await ctx.answerCbQuery().catch(() => {});

		const telegramUserId = ctx.from.id;

		switch (callback.action) {
			case CallbackAction.Menu:
				await menuHandler(useCases)(ctx);

				return;
			case CallbackAction.Sets:
				await quizSetListHandler(useCases, CallbackAction.StartSet)(ctx);

				return;
			case CallbackAction.Statistics:
				await quizSetListHandler(useCases, CallbackAction.StatisticsFor)(ctx);

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

	// Typing anything at all should get the menu back, not silence — it is the
	// only recovery route when a screen can no longer be edited.
	bot.on("message", menuHandler(useCases));

	// Without this Telegraf's default handler rethrows, which aborts the polling
	// loop and exits the process on any unhandled failure.
	bot.catch((error) => {
		options.log?.(error);
	});

	return bot;
}
