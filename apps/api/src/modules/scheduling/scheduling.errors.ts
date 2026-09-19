import type { QuestionId } from "@/modules/quizzes";

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

export class QuestionNotFoundError extends Error {
	readonly questionId: QuestionId;

	constructor(questionId: QuestionId) {
		super(`No quiz set holds question ${questionId}`);
		this.name = "QuestionNotFoundError";
		this.questionId = questionId;
	}
}
