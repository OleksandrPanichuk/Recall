import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const makeTempDirectory = (prefix: string): string =>
	mkdtempSync(join(tmpdir(), prefix));

export function removeTempDirectory(directory: string): boolean {
	try {
		rmSync(directory, {
			recursive: true,
			force: true,
			maxRetries: 20,
			retryDelay: 100,
		});

		return true;
	} catch {
		return false;
	}
}
