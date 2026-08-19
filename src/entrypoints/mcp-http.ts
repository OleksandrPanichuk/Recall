import { resolve } from "node:path";
import { createMcpHttpApp } from "@/adapters/mcp/http/app";
import { createOAuthProvider } from "@/adapters/mcp/http/oauth/provider";
import { createSqliteOAuthStore } from "@/adapters/persistence/sqlite/repositories/sqlite-oauth.store";
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
			`Configuration is valid. database=${resolve(environment.databasePath)} host=${http.host} port=${http.port} oauth=${http.oauth === undefined ? "off" : http.oauth.issuer.href}`,
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
	const oauth = createOAuthProvider({
		store: createSqliteOAuthStore(
			application.client,
			application.transaction,
			() => new Date(),
		),
		staticToken: http.token,
		now: () => new Date(),
	});
	const app = createMcpHttpApp({
		application,
		logger,
		oauth,
		allowedHosts: http.allowedHosts,
		issuer: http.oauth?.issuer,
		passphrase: http.oauth?.passphrase,
	});
	const listener = app.listen(http.port, http.host);
	const shutdown = createShutdown({ logger });

	logger.info("mcp http ready", {
		host: http.host,
		port: http.port,
		databasePath: resolve(environment.databasePath),
		dnsRebindingProtection: http.allowedHosts.length > 0,
		oauth: http.oauth !== undefined,
	});

	shutdown.register({
		name: "http",
		run: () =>
			new Promise<void>((done) => {
				listener.close(() => done());
			}),
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
