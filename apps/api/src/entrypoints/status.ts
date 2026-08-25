import { createApplication } from "@/composition/create-application";
import { describeDatabaseUrl } from "@/infrastructure/config/database-url";
import { formatStatus, readStatus } from "@/infrastructure/lifecycle/status";
import { loadApiEnvironment } from "@/modules/shared/config/api-env";

async function main(): Promise<void> {
	const environment = loadApiEnvironment();
	const application = createApplication({
		databaseUrl: environment.databaseUrl,
	});

	if (process.argv.includes("--check")) {
		console.log(
			`Configuration is valid. database=${describeDatabaseUrl(environment.databaseUrl)}`,
		);
		await application.close();

		return;
	}

	try {
		console.log(
			formatStatus(
				await readStatus(application.connection.db, {
					databaseUrl: environment.databaseUrl,
					timezone: process.env.APP_TIMEZONE ?? "UTC",
				}),
			),
		);
	} finally {
		await application.close();
	}
}

await main();
