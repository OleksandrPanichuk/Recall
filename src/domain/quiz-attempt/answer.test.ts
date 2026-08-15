import { describe, expect, test } from "bun:test";
import { anOption, aQuestion } from "@tests/fixtures/quiz-set.fixture";
import { QuestionType, toQuestionOptionId } from "../quiz-set/question";
import {
	correctOptionIds,
	evaluateAnswer,
	optionsAnswer,
	orderAnswer,
	pairsAnswer,
	textAnswer,
} from "./answer";
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

		expect(evaluateAnswer(question, optionsAnswer([correct as never]))).toBe(
			true,
		);
	});

	test("rejects the wrong single choice", () => {
		const question = singleChoice();
		const wrong = idsOf(question)[1];

		expect(evaluateAnswer(question, optionsAnswer([wrong as never]))).toBe(
			false,
		);
	});

	test("accepts every correct option of a multiple choice, in any order", () => {
		const question = multipleChoice();
		const [a, b] = idsOf(question);

		expect(
			evaluateAnswer(question, optionsAnswer([b as never, a as never])),
		).toBe(true);
	});

	test("rejects a partial multiple choice", () => {
		const question = multipleChoice();
		const [a] = idsOf(question);

		expect(evaluateAnswer(question, optionsAnswer([a as never]))).toBe(false);
	});

	test("rejects a multiple choice with an extra wrong option", () => {
		const question = multipleChoice();
		const [a, b, c] = idsOf(question);

		expect(
			evaluateAnswer(
				question,
				optionsAnswer([a as never, b as never, c as never]),
			),
		).toBe(false);
	});

	test("ignores a repeated selection", () => {
		const question = singleChoice();
		const [correct] = idsOf(question);

		expect(
			evaluateAnswer(
				question,
				optionsAnswer([correct as never, correct as never]),
			),
		).toBe(true);
	});

	test("rejects an option that belongs to another question", () => {
		expect(() =>
			evaluateAnswer(
				singleChoice(),
				optionsAnswer([idsOf(multipleChoice())[0] as never]),
			),
		).toThrow(QuizAttemptValidationError);
	});

	test("rejects an empty selection", () => {
		expect(() => evaluateAnswer(singleChoice(), optionsAnswer([]))).toThrow(
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

const typedAnswer = () =>
	aQuestion({
		id: "question-typed",
		type: QuestionType.TypedAnswer,
		prompt: "кіт",
		options: [
			anOption({
				id: "accepted-cat",
				text: "cat",
				isCorrect: true,
				position: 0,
			}),
		],
	});

const ordering = () =>
	aQuestion({
		id: "question-order",
		type: QuestionType.Ordering,
		prompt: "Build the question",
		options: [
			anOption({ id: "w-0", text: "where", isCorrect: true, position: 0 }),
			anOption({
				id: "w-1",
				text: "the station",
				isCorrect: true,
				position: 1,
			}),
			anOption({ id: "w-2", text: "is", isCorrect: true, position: 2 }),
		],
	});

const matching = () =>
	aQuestion({
		id: "question-match",
		type: QuestionType.Matching,
		prompt: "Match the words",
		options: [
			anOption({
				id: "en-cat",
				text: "cat",
				isCorrect: true,
				position: 0,
				matchKey: "a",
			}),
			anOption({
				id: "en-dog",
				text: "dog",
				isCorrect: true,
				position: 1,
				matchKey: "b",
			}),
			anOption({
				id: "ua-cat",
				text: "кіт",
				isCorrect: true,
				position: 2,
				matchKey: "a",
			}),
			anOption({
				id: "ua-dog",
				text: "пес",
				isCorrect: true,
				position: 3,
				matchKey: "b",
			}),
		],
	});

describe("evaluateAnswer for typed answers", () => {
	test("accepts an exact match", () => {
		expect(evaluateAnswer(typedAnswer(), textAnswer("cat"))).toBe(true);
	});

	test("ignores case and surrounding whitespace", () => {
		expect(evaluateAnswer(typedAnswer(), textAnswer("  CAT "))).toBe(true);
	});

	test("rejects a different word", () => {
		expect(evaluateAnswer(typedAnswer(), textAnswer("dog"))).toBe(false);
	});

	test("rejects a near miss rather than quietly accepting it", () => {
		expect(evaluateAnswer(typedAnswer(), textAnswer("cta"))).toBe(false);
	});

	test("accepts any of several accepted spellings", () => {
		const question = aQuestion({
			id: "question-colour",
			type: QuestionType.TypedAnswer,
			prompt: "колір",
			options: [
				anOption({ id: "a", text: "colour", isCorrect: true, position: 0 }),
				anOption({ id: "b", text: "color", isCorrect: true, position: 1 }),
			],
		});

		expect(evaluateAnswer(question, textAnswer("color"))).toBe(true);
		expect(evaluateAnswer(question, textAnswer("colour"))).toBe(true);
	});

	test("rejects an empty answer", () => {
		expect(() => evaluateAnswer(typedAnswer(), textAnswer("   "))).toThrow(
			QuizAttemptValidationError,
		);
	});

	test("refuses an option answer", () => {
		expect(() =>
			evaluateAnswer(
				typedAnswer(),
				optionsAnswer([toQuestionOptionId("accepted-cat")]),
			),
		).toThrow(QuizAttemptValidationError);
	});
});

describe("evaluateAnswer for ordering", () => {
	test("accepts the declared order", () => {
		const question = ordering();

		expect(evaluateAnswer(question, orderAnswer(idsOf(question)))).toBe(true);
	});

	test("rejects a different order", () => {
		const question = ordering();
		const [first, second, third] = idsOf(question);

		expect(
			evaluateAnswer(
				question,
				orderAnswer([first as never, third as never, second as never]),
			),
		).toBe(false);
	});

	test("rejects an incomplete sequence", () => {
		const question = ordering();
		const [first] = idsOf(question);

		expect(evaluateAnswer(question, orderAnswer([first as never]))).toBe(false);
	});

	test("refuses an unordered option answer", () => {
		const question = ordering();

		expect(() =>
			evaluateAnswer(question, optionsAnswer(idsOf(question))),
		).toThrow(QuizAttemptValidationError);
	});
});

describe("evaluateAnswer for matching", () => {
	const pair = (left: string, right: string) =>
		[toQuestionOptionId(left), toQuestionOptionId(right)] as const;

	test("accepts every correct pair", () => {
		expect(
			evaluateAnswer(
				matching(),
				pairsAnswer([pair("en-cat", "ua-cat"), pair("en-dog", "ua-dog")]),
			),
		).toBe(true);
	});

	test("accepts pairs given in either direction", () => {
		expect(
			evaluateAnswer(
				matching(),
				pairsAnswer([pair("ua-cat", "en-cat"), pair("ua-dog", "en-dog")]),
			),
		).toBe(true);
	});

	test("rejects a crossed pair", () => {
		expect(
			evaluateAnswer(
				matching(),
				pairsAnswer([pair("en-cat", "ua-dog"), pair("en-dog", "ua-cat")]),
			),
		).toBe(false);
	});

	test("rejects a partial answer", () => {
		expect(
			evaluateAnswer(matching(), pairsAnswer([pair("en-cat", "ua-cat")])),
		).toBe(false);
	});
});
