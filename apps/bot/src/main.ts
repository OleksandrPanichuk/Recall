import { createBotClient } from "@recall/contracts";
import { createLogger, createShutdown, LogLevel } from "@recall/kit";
import {
	type BotEnvironment,
	BotEnvironmentError,
	loadBotEnvironment,
} from "./config";
import { createBot } from "./telegram/bot";
import { startDailyReminder } from "./telegram/reminders";

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
			bot.stop("shutdown");
		},
	});
	shutdown.listen();

	logger.info("starting bot", {
		api: environment.apiUrl.href,
		timezone: environment.timezone,
	});

	bot.launch({ dropPendingUpdates: true }).catch((error: unknown) => {
		logger.error("bot stopped", { error });
		void shutdown.trigger("launch-failed").then(() => {
			process.exitCode = 1;
		});
	});
}

main();
