import { resolve } from "node:path";
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

	if (process.argv.includes("--check")) {
		console.log(
			`Configuration is valid. database=${resolve(environment.databasePath)} timezone=${environment.appTimezone}`,
		);

		return;
	}

	const logger = createLogger({
		level: process.argv.includes("--debug") ? LogLevel.Debug : LogLevel.Info,
	});
	const application = createApplication({
		databasePath: environment.databasePath,
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
		databasePath: resolve(environment.databasePath),
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

main();
