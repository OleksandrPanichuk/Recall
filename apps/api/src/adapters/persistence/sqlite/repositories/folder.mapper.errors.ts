export class CorruptedFolderRowError extends Error {
	readonly issues: readonly string[];

	constructor(id: string, issues: readonly string[]) {
		super(
			`Folder ${id} cannot be restored from storage:\n${issues
				.map((issue) => `- ${issue}`)
				.join("\n")}`,
		);
		this.name = "CorruptedFolderRowError";
		this.issues = issues;
	}
}
