export class CorruptedRepetitionRowError extends Error {
	readonly rowId: string;
	readonly issues: readonly string[];

	constructor(rowId: string, issues: readonly string[]) {
		super(
			`Repetition row ${rowId} is corrupted:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
		);
		this.name = "CorruptedRepetitionRowError";
		this.rowId = rowId;
		this.issues = issues;
	}
}
