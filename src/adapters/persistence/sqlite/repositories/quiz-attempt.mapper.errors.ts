export class CorruptedQuizAttemptRowError extends Error {
	readonly issues: readonly string[];

	constructor(id: string, issues: readonly string[]) {
		super(
			`Quiz attempt ${id} cannot be restored from storage:\n${issues
				.map((issue) => `- ${issue}`)
				.join("\n")}`,
		);
		this.name = "CorruptedQuizAttemptRowError";
		this.issues = issues;
	}
}
