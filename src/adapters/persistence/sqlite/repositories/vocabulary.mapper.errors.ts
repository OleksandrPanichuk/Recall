export class CorruptedVocabularyRowError extends Error {
	readonly itemId: string;
	readonly issues: readonly string[];

	constructor(itemId: string, issues: readonly string[]) {
		super(
			`Vocabulary item ${itemId} is corrupted:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
		);
		this.name = "CorruptedVocabularyRowError";
		this.itemId = itemId;
		this.issues = issues;
	}
}
