import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const makeTempDirectory = (prefix: string): string =>
	mkdtempSync(join(tmpdir(), prefix));

export function removeTempDirectory(directory: string): void {
	rmSync(directory, {
		recursive: true,
		force: true,
		maxRetries: 5,
		retryDelay: 50,
	});
}
