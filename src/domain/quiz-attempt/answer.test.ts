import { describe, expect, test } from "bun:test";
import { anOption, aQuestion } from "@tests/fixtures/quiz-set.fixture";
import { QuestionType } from "../quiz-set/question";
import { correctOptionIds, evaluateAnswer } from "./answer";
import { QuizAttemptValidationError } from "./quiz-attempt.errors";

const singleChoice = () => aQuestion({ id: "question-1" });

const multipleChoice = () =>
	aQuestion({
		id: "question-2",
		type: QuestionType.MultipleChoice,
		options: [
			anOption({ id: "option-a", text: "A", isCorrect: true, position: 0 }),
			anOption({ id: "option-b", text: "B", isCorrect: true, position: 1 }),
			anOption({ id: "option-c", text: "C", isCorrect: false, position: 2 }),
		],
	});

const idsOf = (question: ReturnType<typeof aQuestion>) =>
	question.options.map((option) => option.id);

describe("evaluateAnswer", () => {
	test("accepts the correct single choice", () => {
		const question = singleChoice();
		const [correct] = idsOf(question);

		expect(evaluateAnswer(question, [correct as never])).toBe(true);
	});

	test("rejects the wrong single choice", () => {
		const question = singleChoice();
		const wrong = idsOf(question)[1];

		expect(evaluateAnswer(question, [wrong as never])).toBe(false);
	});

	test("accepts every correct option of a multiple choice, in any order", () => {
		const question = multipleChoice();
		const [a, b] = idsOf(question);

		expect(evaluateAnswer(question, [b as never, a as never])).toBe(true);
	});

	test("rejects a partial multiple choice", () => {
		const question = multipleChoice();
		const [a] = idsOf(question);

		expect(evaluateAnswer(question, [a as never])).toBe(false);
	});

	test("rejects a multiple choice with an extra wrong option", () => {
		const question = multipleChoice();
		const [a, b, c] = idsOf(question);

		expect(evaluateAnswer(question, [a as never, b as never, c as never])).toBe(
			false,
		);
	});

	test("ignores a repeated selection", () => {
		const question = singleChoice();
		const [correct] = idsOf(question);

		expect(evaluateAnswer(question, [correct as never, correct as never])).toBe(
			true,
		);
	});

	test("rejects an option that belongs to another question", () => {
		expect(() =>
			evaluateAnswer(singleChoice(), [idsOf(multipleChoice())[0] as never]),
		).toThrow(QuizAttemptValidationError);
	});

	test("rejects an empty selection", () => {
		expect(() => evaluateAnswer(singleChoice(), [])).toThrow(
			QuizAttemptValidationError,
		);
	});
});

describe("correctOptionIds", () => {
	test("returns every correct option in order", () => {
		expect(correctOptionIds(multipleChoice()).map(String)).toEqual([
			"option-a",
			"option-b",
		]);
	});
});
