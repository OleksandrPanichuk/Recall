import { EnvironmentError, loadEnvironment } from "@/infrastructure/config/env";
import { backupDatabase } from "@/infrastructure/lifecycle/backup";

function targetPath(databasePath: string): string {
	const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");

	return process.argv[2] ?? `${databasePath}.${stamp}.backup.sqlite`;
}

try {
	const environment = loadEnvironment();
	const target = targetPath(environment.databasePath);

	backupDatabase(environment.databasePath, target);
	console.log(`Backed up ${environment.databasePath} to ${target}`);
} catch (error) {
	console.error(
		error instanceof EnvironmentError || error instanceof Error
			? error.message
			: String(error),
	);
	process.exit(1);
}
