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

	console.log(
		`Configuration is valid. database=${environment.databasePath} timezone=${environment.appTimezone}`,
	);
}

main();
