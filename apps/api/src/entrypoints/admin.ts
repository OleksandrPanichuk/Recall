import { createAdminApi } from "@/adapters/admin/api";
import index from "@/adapters/admin/ui/index.html";
import { createApplication } from "@/composition/create-application";
import { describeDatabaseUrl } from "@/infrastructure/config/database-url";
import {
	type AdminEnvironment,
	type Environment,
	EnvironmentError,
	loadAdminEnvironment,
	loadEnvironment,
} from "@/infrastructure/config/env";
import { createShutdown } from "@/infrastructure/lifecycle/shutdown";
import { createLogger } from "@/infrastructure/logging/logger";
import { LogLevel } from "@/infrastructure/logging/logger.types";

interface Configuration {
	readonly environment: Environment;
	readonly admin: AdminEnvironment;
}

function loadOrExit(): Configuration {
	try {
		return { environment: loadEnvironment(), admin: loadAdminEnvironment() };
	} catch (error) {
		if (error instanceof EnvironmentError) {
			console.error(error.message);
			process.exit(1);
		}

		throw error;
	}
}

function main(): void {
	const { environment, admin } = loadOrExit();

	if (process.argv.includes("--check")) {
		console.log(
			`Configuration is valid. database=${describeDatabaseUrl(environment.databaseUrl)} host=${admin.host} port=${admin.port}`,
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
	const server = Bun.serve({
		hostname: admin.host,
		port: admin.port,
		routes: {
			"/": index,
			...createAdminApi({
				application,
				logger,
				passphrase: admin.passphrase,
				telegramUserId: environment.allowedTelegramUserId,
				now: () => new Date(),
			}),
		},
		development: process.argv.includes("--debug"),
	});
	const shutdown = createShutdown({ logger });

	logger.info("admin ready", {
		host: admin.host,
		port: admin.port,
		databasePath: environment.databaseUrl,
	});

	shutdown.register({
		name: "admin",
		run: async () => {
			await server.stop();
		},
	});
	shutdown.register({
		name: "database",
		run: () => {
			void application.close();
		},
	});
	shutdown.listen();
}

main();
