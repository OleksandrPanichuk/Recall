import { createDrizzleClient } from "@/adapters/persistence/sqlite/database";
import { createBot } from "@/adapters/telegram/bot";
import { createApplication } from "@/composition/create-application";
import {
	type Environment,
	EnvironmentError,
	loadEnvironment,
} from "@/infrastructure/config/env";
import { createShutdown } from "@/infrastructure/lifecycle/shutdown";
import { formatStatus, readStatus } from "@/infrastructure/lifecycle/status";
import { createLogger, LogLevel } from "@/infrastructure/logging/logger";

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

function main(): void {
	const environment = loadOrExit();

	// `--check` validates configuration and exits, without opening the database or
	// contacting Telegram, so it is safe to run against a live deployment.
	if (process.argv.includes("--check")) {
		console.log(
			`Configuration is valid. database=${environment.databasePath} timezone=${environment.appTimezone}`,
		);

		return;
	}

	const logger = createLogger({
		level: process.argv.includes("--debug") ? LogLevel.Debug : LogLevel.Info,
	});
	const application = createApplication({
		databasePath: environment.databasePath,
		timezone: environment.appTimezone,
	});

	if (process.argv.includes("--status")) {
		console.log(
			formatStatus(
				readStatus(createDrizzleClient(application.database), {
					databasePath: environment.databasePath,
					timezone: environment.appTimezone,
				}),
			),
		);
		application.close();

		return;
	}

	const bot = createBot({
		token: environment.telegramBotKey,
		allowedTelegramUserId: environment.allowedTelegramUserId,
		useCases: application,
		log: (error) => {
			logger.error("handler failed", { error });
		},
	});
	const shutdown = createShutdown({ logger });

	// Registered in start-up order and run in reverse, so polling stops before the
	// database it writes to closes — otherwise a signal arriving mid-answer would
	// pull the handle out from under an open transaction.
	shutdown.register({
		name: "database",
		run: () => {
			application.close();
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
		databasePath: environment.databasePath,
		timezone: environment.appTimezone,
	});

	// launch() only settles when polling stops, so a rejection here means Telegram
	// refused us outright — a bad token, or no network. Report it and tear down
	// rather than leaving an unhandled rejection and a half-open database.
	bot.launch().catch((error: unknown) => {
		logger.error("bot stopped", { error });
		void shutdown.trigger("launch-failed").then(() => {
			process.exitCode = 1;
		});
	});
}

main();
