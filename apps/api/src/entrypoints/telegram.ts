import { createBot } from "@/adapters/telegram/bot";
import { startDailyReminder } from "@/adapters/telegram/reminders";
import { createApplication } from "@/composition/create-application";
import { describeDatabaseUrl } from "@/infrastructure/config/database-url";
import {
	type Environment,
	EnvironmentError,
	loadEnvironment,
} from "@/infrastructure/config/env";
import { createShutdown } from "@/infrastructure/lifecycle/shutdown";
import { formatStatus, readStatus } from "@/infrastructure/lifecycle/status";
import { createLogger } from "@/infrastructure/logging/logger";
import { LogLevel } from "@/infrastructure/logging/logger.types";

const REMINDER_HOUR = 9;

function loadOrExit(): Environment {
	try {
		return loadEnvironment();
	} catch (error) {
		if (error instanceof EnvironmentError) {
			console.error(error.message);
			process.exit(1);
		}

		throw error;
	}
}

async function main(): Promise<void> {
	const environment = loadOrExit();

	if (process.argv.includes("--check")) {
		console.log(
			`Configuration is valid. database=${describeDatabaseUrl(environment.databaseUrl)} timezone=${environment.appTimezone}`,
		);

		return;
	}

	const logger = createLogger({
		level: process.argv.includes("--debug") ? LogLevel.Debug : LogLevel.Info,
	});
	const application = createApplication({
		databaseUrl: environment.databaseUrl,
		logger,
	});

	if (process.argv.includes("--status")) {
		console.log(
			formatStatus(
				await readStatus(application.connection.db, {
					databaseUrl: environment.databaseUrl,
					timezone: environment.appTimezone,
				}),
			),
		);
		await application.close();

		return;
	}

	const bot = createBot({
		token: environment.telegramBotKey,
		allowedTelegramUserId: environment.allowedTelegramUserId,
		useCases: application,
		logger,
	});
	const reminder = startDailyReminder({
		bot,
		listDueRepetitions: application.listDueRepetitions,
		telegramUserId: environment.allowedTelegramUserId,
		timezone: environment.appTimezone,
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
		name: "database",
		run: () => {
			void application.close();
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
		databasePath: environment.databaseUrl,
		timezone: environment.appTimezone,
	});

	// Telegram replays updates queued during downtime for up to 24 hours, and each
	// would act on a screen the user moved past hours ago.
	bot.launch({ dropPendingUpdates: true }).catch((error: unknown) => {
		logger.error("bot stopped", { error });
		void shutdown.trigger("launch-failed").then(() => {
			process.exitCode = 1;
		});
	});
}

await main();
