// Temporary entrypoint. It validates startup configuration and refuses to run
// on an invalid environment until the first quiz-bot vertical slice adds
// Telegram long polling.
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

	// The bot token and the Telegram user id stay out of the log on purpose.
	console.log(
		`Configuration is valid. database=${environment.databasePath} timezone=${environment.appTimezone}`,
	);
}

main();
