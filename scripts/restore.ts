import { existsSync, renameSync } from "node:fs";
import { EnvironmentError, loadEnvironment } from "@/infrastructure/config/env";
import { assertRestorable } from "@/infrastructure/lifecycle/backup";

const backupPath = process.argv[2];

try {
	if (backupPath === undefined) {
		throw new Error("Usage: bun run restore <backup-file>");
	}

	const environment = loadEnvironment();

	assertRestorable(backupPath);

	// The current database is moved aside rather than overwritten: restoring the
	// wrong file must not be the last thing that ever happens to real history.
	if (existsSync(environment.databasePath)) {
		const aside = `${environment.databasePath}.replaced-${new Date()
			.toISOString()
			.replaceAll(/[:.]/g, "-")}`;

		renameSync(environment.databasePath, aside);
		console.log(`Moved the existing database to ${aside}`);
	}

	// The sidecars belong to the replaced database, not the restored one.
	for (const suffix of ["-wal", "-shm"]) {
		const sidecar = `${environment.databasePath}${suffix}`;

		if (existsSync(sidecar)) {
			renameSync(sidecar, `${sidecar}.replaced`);
		}
	}

	await Bun.write(environment.databasePath, Bun.file(backupPath));
	console.log(`Restored ${backupPath} to ${environment.databasePath}`);
} catch (error) {
	console.error(
		error instanceof EnvironmentError || error instanceof Error
			? error.message
			: String(error),
	);
	process.exit(1);
}
