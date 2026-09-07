import { describeDatabaseUrl } from "@/configs/database-url";
import { loadApiEnvironment } from "@/configs/env.config";
import { DatabaseConnection } from "@/db/connection";
import { formatStatus, readStatus } from "@/infrastructure/lifecycle/status";

async function main(): Promise<void> {
	const environment = loadApiEnvironment();

	if (process.argv.includes("--check")) {
		console.log(
			`Configuration is valid. database=${describeDatabaseUrl(environment.databaseUrl)}`,
		);

		return;
	}

	const connection = new DatabaseConnection({ url: environment.databaseUrl });

	try {
		console.log(
			formatStatus(
				await readStatus(connection.db, {
					databaseUrl: environment.databaseUrl,
					timezone: process.env.APP_TIMEZONE ?? "UTC",
				}),
			),
		);
	} finally {
		await connection.close();
	}
}

await main();
