import { type BotUseCases, QuizAttemptMode } from "@recall/contracts";
import type { Logger } from "@recall/kit";
import { normaliseForComparison } from "@recall/kit";
import { Telegraf } from "telegraf";
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
import { loginHandler } from "./handlers/login.handler";
import { practiceHandler } from "./handlers/practice.handler";
import { repetitionsHandler } from "./handlers/repetitions.handler";
import {
	settingsEditHandler,
	settingsForHandler,
	settingsMenuHandler,
} from "./handlers/settings.handler";
import { menuHandler, resumeHandler } from "./handlers/start.handler";
import { startAttemptHandler } from "./handlers/start-attempt.handler";
import { statisticsHandler } from "./handlers/statistics.handler";
import {
	issueTokenHandler,
	listTokensHandler,
	revokeTokenHandler,
} from "./handlers/tokens.handler";
import { allowlistMiddleware } from "./middleware/allowlist.middleware";
import { errorMiddleware } from "./middleware/error.middleware";
import { loggingMiddleware } from "./middleware/logging.middleware";

export type TelegramUseCases = BotUseCases;

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
	bot.command("login", loginHandler(useCases));
	bot.command("tokens", listTokensHandler(useCases));
	bot.command("token", async (ctx) => {
		const name = ctx.message.text.slice("/token".length).trim();

		await issueTokenHandler(useCases)(ctx, name.length === 0 ? "mcp" : name);
	});
	bot.command("revoke", async (ctx) => {
		const id = ctx.message.text.slice("/revoke".length).trim();

		if (id.length === 0) {
			await listTokensHandler(useCases)(ctx);

			return;
		}

		await revokeTokenHandler(useCases)(ctx, id);
	});

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

		await ctx.answerCbQuery().catch(() => {});

		const _telegramUserId = ctx.from.id;

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
			case CallbackAction.Settings:
				await settingsMenuHandler()(ctx);

				return;
			case CallbackAction.Login:
				await loginHandler(useCases)(ctx);

				return;
			case CallbackAction.SettingsFor:
				await settingsForHandler(useCases)(ctx, callback);

				return;
			case CallbackAction.SettingsEdit:
				await settingsEditHandler(useCases)(ctx, callback);

				return;
			case CallbackAction.Statistics:
				await browseHandler(useCases)(ctx, {
					action: CallbackAction.Browse,
					leaf: CallbackAction.StatisticsFor,
				});

				return;
			case CallbackAction.Mistakes:
				await browseHandler(useCases)(ctx, {
					action: CallbackAction.Browse,
					leaf: CallbackAction.MistakesFor,
				});

				return;
			case CallbackAction.WeakTopics:
				await browseHandler(useCases)(ctx, {
					action: CallbackAction.Browse,
					leaf: CallbackAction.WeakTopicsFor,
				});

				return;
			case CallbackAction.MistakesFor:
				await practiceHandler(useCases)(ctx, {
					quizSetId: callback.quizSetId,
					mode: QuizAttemptMode.Mistakes,
				});

				return;
			case CallbackAction.WeakTopicsFor:
				await practiceHandler(useCases)(ctx, {
					quizSetId: callback.quizSetId,
					mode: QuizAttemptMode.WeakTopics,
				});

				return;
			case CallbackAction.Browse:
				await browseHandler(useCases)(ctx, callback);

				return;
			case CallbackAction.StartSet:
				await startAttemptHandler(useCases)(ctx, {
					quizSetId: callback.quizSetId,
				});

				return;
			case CallbackAction.StartDue:
				await startAttemptHandler(useCases)(ctx, {
					quizSetId: callback.quizSetId,
					onlyDue: true,
				});

				return;
			case CallbackAction.StatisticsFor:
				await statisticsHandler(useCases)(ctx, {
					quizSetId: callback.quizSetId,
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
		}
	});

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
