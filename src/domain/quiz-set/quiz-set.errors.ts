export class InvalidIdentifierError extends Error {
	constructor(label: string) {
		super(`${label} must be a non-empty identifier`);
		this.name = "InvalidIdentifierError";
	}
}

export class QuestionValidationError extends Error {
	readonly issues: readonly string[];

	constructor(issues: readonly string[]) {
		super(
			`Invalid question:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
		);
		this.name = "QuestionValidationError";
		this.issues = issues;
	}
}
