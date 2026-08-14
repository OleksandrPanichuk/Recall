import { resolve } from "node:path";
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

async function main(): Promise<void> {
	let environment: Environment;

	try {
		environment = loadEnvironment();
	} catch (error) {
		if (error instanceof EnvironmentError) {
			// stdio carries the protocol, so diagnostics must go to stderr only.
			console.error(error.message);
			process.exit(1);
		}

		throw error;
	}

	const application = createApplication({
		databasePath: environment.databasePath,
	});
	const server = createMcpServer(application);
	// stdout carries the protocol, so every log line goes to stderr.
	const logger = createLogger();
	const shutdown = createShutdown({ logger });

	logger.info("mcp server ready", {
		databasePath: resolve(environment.databasePath),
		timezone: environment.appTimezone,
	});

	shutdown.register({
		name: "database",
		run: () => {
			application.close();
		},
	});
	shutdown.register({ name: "mcp", run: () => server.close() });
	shutdown.listen();

	await server.connect(new StdioServerTransport());
}

await main();
