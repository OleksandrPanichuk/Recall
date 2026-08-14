export class CategoryValidationError extends Error {
	readonly issues: readonly string[];

	constructor(issues: readonly string[]) {
		super(
			`Invalid category:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
		);
		this.name = "CategoryValidationError";
		this.issues = issues;
	}
}

export class CategoryCycleError extends Error {
	constructor() {
		super("A category cannot be placed inside itself or its own descendant");
		this.name = "CategoryCycleError";
	}
}

export class CategoryDepthError extends Error {
	readonly depth: number;
	readonly limit: number;

	constructor(depth: number, limit: number) {
		super(`A category may be nested ${limit} deep; this would be ${depth}`);
		this.name = "CategoryDepthError";
		this.depth = depth;
		this.limit = limit;
	}
}

export class DuplicateCategoryNameError extends Error {
	/** Not `name` — `Error` already owns that, and it holds the error's own name. */
	readonly categoryName: string;

	constructor(categoryName: string) {
		super(`A category named "${categoryName}" already exists here`);
		this.name = "DuplicateCategoryNameError";
		this.categoryName = categoryName;
	}
}
