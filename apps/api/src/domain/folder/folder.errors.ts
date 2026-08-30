export class FolderValidationError extends Error {
	readonly issues: readonly string[];

	constructor(issues: readonly string[]) {
		super(`Invalid folder:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
		this.name = "FolderValidationError";
		this.issues = issues;
	}
}

export class FolderCycleError extends Error {
	constructor() {
		super("A folder cannot be placed inside itself or its own descendant");
		this.name = "FolderCycleError";
	}
}

export class FolderDepthError extends Error {
	readonly depth: number;
	readonly limit: number;

	constructor(depth: number, limit: number) {
		super(`A folder may be nested ${limit} deep; this would be ${depth}`);
		this.name = "FolderDepthError";
		this.depth = depth;
		this.limit = limit;
	}
}

export class DuplicateFolderNameError extends Error {
	readonly folderName: string;

	constructor(folderName: string) {
		super(`A folder named "${folderName}" already exists here`);
		this.name = "DuplicateFolderNameError";
		this.folderName = folderName;
	}
}
