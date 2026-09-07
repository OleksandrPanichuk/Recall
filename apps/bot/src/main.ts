import { createBotClient } from "@recall/contracts";
import { createLogger, createShutdown, LogLevel } from "@recall/kit";
import {
	type BotEnvironment,
	BotEnvironmentError,
	loadBotEnvironment,
} from "./config";
import { keepPolling } from "./lifecycle/keep-polling";
import { onLaunchFailure } from "./lifecycle/launch-failure";
import { createBot } from "./telegram/bot";
import { startDailyReminder } from "./telegram/reminders";
import { createWebhookHandler } from "./telegram/webhook";

const REMINDER_HOUR = 9;

function loadOrExit(): BotEnvironment {
	try {
		return loadBotEnvironment();
	} catch (error) {
		if (error instanceof BotEnvironmentError) {
			console.error(error.message);
			process.exit(1);
		}

		throw error;
	}
}

function main(): void {
	const environment = loadOrExit();

	if (process.argv.includes("--check")) {
		console.log(
			`Configuration is valid. api=${environment.apiUrl.href} timezone=${environment.timezone}`,
		);

		return;
	}

	const logger = createLogger({
		level: process.argv.includes("--debug") ? LogLevel.Debug : LogLevel.Info,
	});
	const useCases = createBotClient({
		baseUrl: new URL("bot/", environment.apiUrl),
		token: environment.apiToken,
	});
	const bot = createBot({
		token: environment.telegramBotKey,
		allowedTelegramUserId: environment.allowedTelegramUserId,
		useCases,
		logger,
		apiRoot: environment.telegramApiRoot,
	});
	const reminder = startDailyReminder({
		bot,
		listDueRepetitions: useCases.listDueRepetitions,
		chatId: environment.allowedTelegramUserId,
		timezone: environment.timezone,
		hour: REMINDER_HOUR,
		now: () => new Date(),
		log: (error) => {
			logger.error("daily reminder failed", { error });
		},
	});
	const shutdown = createShutdown({ logger });

	shutdown.register({
		name: "reminder",
		run: () => {
			reminder.stop();
		},
	});
	shutdown.register({
		name: "telegram",
		run: () => {
			try {
				bot.stop("shutdown");
			} catch (error) {
				logger.debug("telegram was not running", { error });
			}
		},
	});
	shutdown.listen();

	const fail = onLaunchFailure({
		logger,
		shutdown,
		onFatal: () => {
			process.exitCode = 1;
		},
	});

	logger.info("starting bot", {
		api: environment.apiUrl.href,
		timezone: environment.timezone,
		delivery: environment.webhook === undefined ? "polling" : "webhook",
	});

	if (environment.webhook === undefined) {
		void keepPolling({
			launch: (options) => bot.launch(options),
			logger,
			shutdown,
			onFatal: fail,
		});

		return;
	}

	const { url, secret, port } = environment.webhook;
	const server = Bun.serve({
		port,
		fetch: createWebhookHandler({
			path: url.pathname,
			secret,
			handleUpdate: (update) => bot.handleUpdate(update),
			onError: (error) => {
				logger.error("update failed", { error });
			},
		}),
	});

	shutdown.register({
		name: "webhook",
		run: async () => {
			await server.stop();
		},
	});

	bot.telegram
		.setWebhook(url.href, {
			secret_token: secret,
			drop_pending_updates: true,
		})
		.then(() => {
			logger.info("listening for telegram updates", {
				url: url.href,
				port,
			});
		})
		.catch(fail);
}

main();
