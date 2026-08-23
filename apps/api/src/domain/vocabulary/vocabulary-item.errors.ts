export class VocabularyItemValidationError extends Error {
	readonly issues: readonly string[];

	constructor(issues: readonly string[]) {
		super(
			`Invalid vocabulary item:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
		);
		this.name = "VocabularyItemValidationError";
		this.issues = issues;
	}
}
