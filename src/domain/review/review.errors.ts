export class ReviewItemValidationError extends Error {
	readonly issues: readonly string[];

	constructor(issues: readonly string[]) {
		super(
			`Invalid review item:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
		);
		this.name = "ReviewItemValidationError";
		this.issues = issues;
	}
}

/**
 * A retired item has been answered correctly often enough to leave the review
 * rotation; reviewing it again would silently resurrect it.
 */
export class RetiredReviewItemError extends Error {
	constructor() {
		super("A retired review item cannot be reviewed again");
		this.name = "RetiredReviewItemError";
	}
}
