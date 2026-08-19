import { resolve } from "node:path";
import { createMcpHttpHandler } from "@/adapters/mcp/http/handler";
import { createApplication } from "@/composition/create-application";
import {
	type Environment,
	EnvironmentError,
	type HttpEnvironment,
	loadEnvironment,
	loadHttpEnvironment,
} from "@/infrastructure/config/env";
import { createShutdown } from "@/infrastructure/lifecycle/shutdown";
import { createLogger } from "@/infrastructure/logging/logger";
import { LogLevel } from "@/infrastructure/logging/logger.types";

interface Configuration {
	readonly environment: Environment;
	readonly http: HttpEnvironment;
}

function loadOrExit(): Configuration {
	try {
		return { environment: loadEnvironment(), http: loadHttpEnvironment() };
	} catch (error) {
		if (error instanceof EnvironmentError) {
			console.error(error.message);
			process.exit(1);
		}

		throw error;
	}
}

function main(): void {
	const { environment, http } = loadOrExit();

	if (process.argv.includes("--check")) {
		console.log(
			`Configuration is valid. database=${resolve(environment.databasePath)} host=${http.host} port=${http.port}`,
		);

		return;
	}

	const logger = createLogger({
		level: process.argv.includes("--debug") ? LogLevel.Debug : LogLevel.Info,
	});
	const application = createApplication({
		databasePath: environment.databasePath,
		logger,
	});
	const server = Bun.serve({
		hostname: http.host,
		port: http.port,
		fetch: createMcpHttpHandler({
			application,
			logger,
			token: http.token,
			allowedHosts: http.allowedHosts,
		}),
	});
	const shutdown = createShutdown({ logger });

	logger.info("mcp http ready", {
		host: http.host,
		port: http.port,
		databasePath: resolve(environment.databasePath),
		dnsRebindingProtection: http.allowedHosts.length > 0,
	});

	shutdown.register({
		name: "http",
		run: async () => {
			await server.stop();
		},
	});
	shutdown.register({
		name: "database",
		run: () => {
			application.close();
		},
	});
	shutdown.listen();
}

main();
