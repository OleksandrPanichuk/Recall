import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "@/adapters/mcp/server";
import { createApplication } from "@/composition/create-application";
import {
	type Environment,
	EnvironmentError,
	loadEnvironment,
} from "@/infrastructure/config/env";
import { createShutdown } from "@/infrastructure/lifecycle/shutdown";
import { createLogger } from "@/infrastructure/logging/logger";
import { LogLevel } from "@/infrastructure/logging/logger.types";

async function main(): Promise<void> {
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

	const logger = createLogger({
		level: process.argv.includes("--debug") ? LogLevel.Debug : LogLevel.Info,
	});
	const application = createApplication({
		databaseUrl: environment.databaseUrl,
		logger,
	});
	const server = createMcpServer(application, { logger });
	const shutdown = createShutdown({ logger });

	logger.info("mcp server ready", {
		databasePath: environment.databaseUrl,
		timezone: environment.appTimezone,
	});

	shutdown.register({
		name: "database",
		run: () => {
			void application.close();
		},
	});
	shutdown.register({ name: "mcp", run: () => server.close() });
	shutdown.listen();

	await server.connect(new StdioServerTransport());
}

await main();
