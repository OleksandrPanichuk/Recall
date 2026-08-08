import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "@/adapters/mcp/server";
import { createApplication } from "@/composition/create-application";
import {
	type Environment,
	EnvironmentError,
	loadEnvironment,
} from "@/infrastructure/config/env";

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
		timezone: environment.appTimezone,
	});
	const server = createMcpServer(application);

	const stop = (): void => {
		void server.close();
		application.close();
	};

	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);

	await server.connect(new StdioServerTransport());
}

await main();
