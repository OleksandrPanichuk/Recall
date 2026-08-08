import { createBot } from "@/adapters/telegram/bot";
import { createApplication } from "@/composition/create-application";
import {
	type Environment,
	EnvironmentError,
	loadEnvironment,
} from "@/infrastructure/config/env";

function main(): void {
	let environment: Environment;

	try {
		environment = loadEnvironment();
	} catch (error) {
		if (error instanceof EnvironmentError) {
			console.error(error.message);
			process.exit(1);
		}

		throw error;
	}

	// `--check` validates configuration and exits, without opening the database or
	// contacting Telegram, so it is safe to run against a live deployment.
	if (process.argv.includes("--check")) {
		console.log(
			`Configuration is valid. database=${environment.databasePath} timezone=${environment.appTimezone}`,
		);

		return;
	}

	const application = createApplication({
		databasePath: environment.databasePath,
		timezone: environment.appTimezone,
	});
	const bot = createBot({
		token: environment.telegramBotKey,
		allowedTelegramUserId: environment.allowedTelegramUserId,
		useCases: application,
	});

	const stop = (signal: string): void => {
		bot.stop(signal);
		application.close();
	};

	process.once("SIGINT", () => {
		stop("SIGINT");
	});
	process.once("SIGTERM", () => {
		stop("SIGTERM");
	});

	console.log(
		`Starting bot. database=${environment.databasePath} timezone=${environment.appTimezone}`,
	);

	void bot.launch();
}

main();
