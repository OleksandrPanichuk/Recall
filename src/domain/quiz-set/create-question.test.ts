import { describe, expect, test } from "bun:test";
import { createQuestion } from "./create-question";
import {
	Difficulty,
	QuestionType,
	type SingleChoiceQuestion,
	toQuestionId,
	toQuestionOptionId,
} from "./question";
import { QuestionValidationError } from "./quiz-set.errors";

const option = (text: string, isCorrect: boolean, position: number) => ({
	id: toQuestionOptionId(`option-${position}`),
	text,
	isCorrect,
	position,
});

const validDraft = {
	id: toQuestionId("question-1"),
	type: QuestionType.SingleChoice,
	prompt: "  What does replication improve?  ",
	difficulty: Difficulty.Medium,
	position: 0,
	options: [option("Availability", true, 0), option("Index size", false, 1)],
	explanation: "  Replication keeps copies on several nodes.  ",
	topic: "   ",
};

type QuestionDraft = Parameters<typeof createQuestion>[0];

const issuesOf = (draft: QuestionDraft): readonly string[] => {
	try {
		createQuestion(draft);
	} catch (caught) {
		return (caught as QuestionValidationError).issues;
	}

	throw new Error("expected createQuestion to throw");
};

describe("createQuestion", () => {
	describe("with a valid draft", () => {
		test("trims text and drops blank optional fields", () => {
			const question = createQuestion(validDraft);

			expect(question.prompt).toBe("What does replication improve?");
			expect(question.explanation).toBe(
				"Replication keeps copies on several nodes.",
			);
			expect(question.topic).toBeUndefined();
		});

		test("trims option text", () => {
			const question = createQuestion({
				...validDraft,
				options: [
					option("  Availability  ", true, 0),
					option("  Index size  ", false, 1),
				],
			});

			expect(question.options.map((each) => each.text)).toEqual([
				"Availability",
				"Index size",
			]);
		});

		test("returns a frozen question with frozen options", () => {
			const question = createQuestion(validDraft);

			expect(Object.isFrozen(question)).toBe(true);
			expect(Object.isFrozen(question.options)).toBe(true);
			expect(Object.isFrozen(question.options[0])).toBe(true);
		});

		test("preserves the discriminant so the type narrows", () => {
			const question = createQuestion(validDraft);

			if (question.type !== QuestionType.SingleChoice) {
				throw new Error("expected a single choice question");
			}

			const narrowed: SingleChoiceQuestion = question;

			expect(narrowed.type).toBe(QuestionType.SingleChoice);
			expect(narrowed.options).toHaveLength(2);
		});

		test("accepts a multiple choice question with several correct options", () => {
			const question = createQuestion({
				...validDraft,
				type: QuestionType.MultipleChoice,
				options: [
					option("Availability", true, 0),
					option("Read throughput", true, 1),
					option("Index size", false, 2),
				],
			});

			expect(question.type).toBe(QuestionType.MultipleChoice);
			expect(question.options.filter((each) => each.isCorrect)).toHaveLength(2);
		});

		test("accepts a true_false question with exactly two options", () => {
			const question = createQuestion({
				...validDraft,
				type: QuestionType.TrueFalse,
				options: [option("True", true, 0), option("False", false, 1)],
			});

			expect(question.type).toBe(QuestionType.TrueFalse);
		});
	});

	describe("with an invalid draft", () => {
		test("rejects a blank prompt", () => {
			expect(issuesOf({ ...validDraft, prompt: "   " })).toEqual([
				"prompt must not be empty",
			]);
		});

		test("rejects a negative position", () => {
			expect(issuesOf({ ...validDraft, position: -1 })).toEqual([
				"position must be a non-negative integer",
			]);
		});

		test("rejects a fractional position", () => {
			expect(issuesOf({ ...validDraft, position: 1.5 })).toEqual([
				"position must be a non-negative integer",
			]);
		});

		test("rejects a blank option text", () => {
			expect(
				issuesOf({
					...validDraft,
					options: [option("  ", true, 0), option("Index size", false, 1)],
				}),
			).toEqual(["option text must not be empty"]);
		});

		test("rejects option positions that do not form 0..n-1", () => {
			expect(
				issuesOf({
					...validDraft,
					options: [
						option("Availability", true, 0),
						option("Index size", false, 2),
					],
				}),
			).toEqual(["option positions must be unique and start at 0"]);
		});

		test("rejects duplicate option positions", () => {
			expect(
				issuesOf({
					...validDraft,
					options: [
						option("Availability", true, 0),
						{ ...option("Index size", false, 1), position: 0 },
					],
				}),
			).toEqual(["option positions must be unique and start at 0"]);
		});

		test("rejects a single_choice question with fewer than two options", () => {
			expect(
				issuesOf({
					...validDraft,
					options: [option("Availability", true, 0)],
				}),
			).toEqual(["single_choice requires at least two options"]);
		});

		test("rejects a multiple_choice question with fewer than two options", () => {
			expect(
				issuesOf({
					...validDraft,
					type: QuestionType.MultipleChoice,
					options: [option("Availability", true, 0)],
				}),
			).toEqual(["multiple_choice requires at least two options"]);
		});

		test("rejects a true_false question without exactly two options", () => {
			expect(
				issuesOf({
					...validDraft,
					type: QuestionType.TrueFalse,
					options: [
						option("True", true, 0),
						option("False", false, 1),
						option("Maybe", false, 2),
					],
				}),
			).toEqual(["true_false requires exactly two options"]);
		});

		test("rejects a single_choice question without exactly one correct option", () => {
			expect(
				issuesOf({
					...validDraft,
					options: [
						option("Availability", true, 0),
						option("Index size", true, 1),
					],
				}),
			).toEqual(["single_choice requires exactly one correct option"]);
		});

		test("rejects a true_false question without exactly one correct option", () => {
			expect(
				issuesOf({
					...validDraft,
					type: QuestionType.TrueFalse,
					options: [option("True", false, 0), option("False", false, 1)],
				}),
			).toEqual(["true_false requires exactly one correct option"]);
		});

		test("rejects a multiple_choice question without a correct option", () => {
			expect(
				issuesOf({
					...validDraft,
					type: QuestionType.MultipleChoice,
					options: [
						option("Availability", false, 0),
						option("Index size", false, 1),
					],
				}),
			).toEqual(["multiple_choice requires at least one correct option"]);
		});

		test("reports every invariant failure at once", () => {
			let issues: readonly string[] = [];

			try {
				createQuestion({
					...validDraft,
					prompt: "  ",
					options: [option("Only one", false, 0), option("Other", false, 1)],
				});
			} catch (caught) {
				issues = (caught as QuestionValidationError).issues;
			}

			expect(issues).toEqual([
				"prompt must not be empty",
				"single_choice requires exactly one correct option",
			]);
		});

		test("names every issue in the error message", () => {
			expect(() => createQuestion({ ...validDraft, prompt: " " })).toThrow(
				QuestionValidationError,
			);
			expect(() => createQuestion({ ...validDraft, prompt: " " })).toThrow(
				"Invalid question:\n- prompt must not be empty",
			);
		});
	});
});
