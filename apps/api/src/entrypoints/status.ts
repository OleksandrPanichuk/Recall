import { describeDatabaseUrl } from "@/infrastructure/config/database-url";
import { formatStatus, readStatus } from "@/infrastructure/lifecycle/status";
import { loadApiEnvironment } from "@/modules/shared/config/api-env";
import { createPostgresConnection } from "@/persistence/postgres/client";

async function main(): Promise<void> {
	const environment = loadApiEnvironment();

	if (process.argv.includes("--check")) {
		console.log(
			`Configuration is valid. database=${describeDatabaseUrl(environment.databaseUrl)}`,
		);

		return;
	}

	const connection = createPostgresConnection({ url: environment.databaseUrl });

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
