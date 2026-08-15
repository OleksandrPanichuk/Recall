export class CorruptedQuizSetRowError extends Error {
	readonly issues: readonly string[];

	constructor(id: string, issues: readonly string[]) {
		super(
			`Quiz set ${id} cannot be restored from storage:\n${issues
				.map((issue) => `- ${issue}`)
				.join("\n")}`,
		);
		this.name = "CorruptedQuizSetRowError";
		this.issues = issues;
	}
}
