export class RepetitionSettingsValidationError extends Error {
	readonly issues: readonly string[];

	constructor(issues: readonly string[]) {
		super(
			`Invalid repetition settings:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
		);
		this.name = "RepetitionSettingsValidationError";
		this.issues = issues;
	}
}
