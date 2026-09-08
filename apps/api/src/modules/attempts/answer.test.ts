import { describe, expect, test } from "bun:test";
import { anOption, aQuestion } from "@tests/fixtures/quiz-set.fixture";
import { QuestionType, toQuestionOptionId } from "@/modules/quizzes";
import { Answer } from "./answer";
import { QuizAttemptValidationError } from "./attempts.errors";

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

		expect(Answer.evaluate(question, Answer.options([correct as never]))).toBe(
			true,
		);
	});

	test("rejects the wrong single choice", () => {
		const question = singleChoice();
		const wrong = idsOf(question)[1];

		expect(Answer.evaluate(question, Answer.options([wrong as never]))).toBe(
			false,
		);
	});

	test("accepts every correct option of a multiple choice, in any order", () => {
		const question = multipleChoice();
		const [a, b] = idsOf(question);

		expect(
			Answer.evaluate(question, Answer.options([b as never, a as never])),
		).toBe(true);
	});

	test("rejects a partial multiple choice", () => {
		const question = multipleChoice();
		const [a] = idsOf(question);

		expect(Answer.evaluate(question, Answer.options([a as never]))).toBe(false);
	});

	test("rejects a multiple choice with an extra wrong option", () => {
		const question = multipleChoice();
		const [a, b, c] = idsOf(question);

		expect(
			Answer.evaluate(
				question,
				Answer.options([a as never, b as never, c as never]),
			),
		).toBe(false);
	});

	test("ignores a repeated selection", () => {
		const question = singleChoice();
		const [correct] = idsOf(question);

		expect(
			Answer.evaluate(
				question,
				Answer.options([correct as never, correct as never]),
			),
		).toBe(true);
	});

	test("rejects an option that belongs to another question", () => {
		expect(() =>
			Answer.evaluate(
				singleChoice(),
				Answer.options([idsOf(multipleChoice())[0] as never]),
			),
		).toThrow(QuizAttemptValidationError);
	});

	test("rejects an empty selection", () => {
		expect(() => Answer.evaluate(singleChoice(), Answer.options([]))).toThrow(
			QuizAttemptValidationError,
		);
	});
});

describe("correctOptionIds", () => {
	test("returns every correct option in order", () => {
		expect(Answer.correctOptionsOf(multipleChoice()).map(String)).toEqual([
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
		expect(Answer.evaluate(typedAnswer(), Answer.text("cat"))).toBe(true);
	});

	test("ignores case and surrounding whitespace", () => {
		expect(Answer.evaluate(typedAnswer(), Answer.text("  CAT "))).toBe(true);
	});

	test("rejects a different word", () => {
		expect(Answer.evaluate(typedAnswer(), Answer.text("dog"))).toBe(false);
	});

	test("rejects a near miss rather than quietly accepting it", () => {
		expect(Answer.evaluate(typedAnswer(), Answer.text("cta"))).toBe(false);
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

		expect(Answer.evaluate(question, Answer.text("color"))).toBe(true);
		expect(Answer.evaluate(question, Answer.text("colour"))).toBe(true);
	});

	test("rejects an empty answer", () => {
		expect(() => Answer.evaluate(typedAnswer(), Answer.text("   "))).toThrow(
			QuizAttemptValidationError,
		);
	});

	test("refuses an option answer", () => {
		expect(() =>
			Answer.evaluate(
				typedAnswer(),
				Answer.options([toQuestionOptionId("accepted-cat")]),
			),
		).toThrow(QuizAttemptValidationError);
	});
});

describe("evaluateAnswer for ordering", () => {
	test("accepts the declared order", () => {
		const question = ordering();

		expect(Answer.evaluate(question, Answer.order(idsOf(question)))).toBe(true);
	});

	test("rejects a different order", () => {
		const question = ordering();
		const [first, second, third] = idsOf(question);

		expect(
			Answer.evaluate(
				question,
				Answer.order([first as never, third as never, second as never]),
			),
		).toBe(false);
	});

	test("rejects an incomplete sequence", () => {
		const question = ordering();
		const [first] = idsOf(question);

		expect(Answer.evaluate(question, Answer.order([first as never]))).toBe(
			false,
		);
	});

	test("refuses an unordered option answer", () => {
		const question = ordering();

		expect(() =>
			Answer.evaluate(question, Answer.options(idsOf(question))),
		).toThrow(QuizAttemptValidationError);
	});
});

describe("evaluateAnswer for matching", () => {
	const pair = (left: string, right: string) =>
		[toQuestionOptionId(left), toQuestionOptionId(right)] as const;

	test("accepts every correct pair", () => {
		expect(
			Answer.evaluate(
				matching(),
				Answer.pairs([pair("en-cat", "ua-cat"), pair("en-dog", "ua-dog")]),
			),
		).toBe(true);
	});

	test("accepts pairs given in either direction", () => {
		expect(
			Answer.evaluate(
				matching(),
				Answer.pairs([pair("ua-cat", "en-cat"), pair("ua-dog", "en-dog")]),
			),
		).toBe(true);
	});

	test("rejects a crossed pair", () => {
		expect(
			Answer.evaluate(
				matching(),
				Answer.pairs([pair("en-cat", "ua-dog"), pair("en-dog", "ua-cat")]),
			),
		).toBe(false);
	});

	test("rejects a partial answer", () => {
		expect(
			Answer.evaluate(matching(), Answer.pairs([pair("en-cat", "ua-cat")])),
		).toBe(false);
	});
});

describe("gradeAnswer", () => {
	const pair = (left: string, right: string) =>
		[toQuestionOptionId(left), toQuestionOptionId(right)] as const;

	test("credits every correctly matched pair", () => {
		expect(
			Answer.grade(
				matching(),
				Answer.pairs([pair("en-cat", "ua-cat"), pair("en-dog", "ua-dog")]),
			),
		).toEqual({ earned: 2, possible: 2 });
	});

	test("credits the pairs that are right when others are crossed", () => {
		const question = aQuestion({
			id: "question-three",
			type: QuestionType.Matching,
			prompt: "Match three",
			options: [
				anOption({
					id: "a",
					text: "a",
					isCorrect: true,
					position: 0,
					matchKey: "p0",
				}),
				anOption({
					id: "b",
					text: "b",
					isCorrect: true,
					position: 1,
					matchKey: "p1",
				}),
				anOption({
					id: "c",
					text: "c",
					isCorrect: true,
					position: 2,
					matchKey: "p2",
				}),
				anOption({
					id: "x",
					text: "x",
					isCorrect: true,
					position: 3,
					matchKey: "p0",
				}),
				anOption({
					id: "y",
					text: "y",
					isCorrect: true,
					position: 4,
					matchKey: "p1",
				}),
				anOption({
					id: "z",
					text: "z",
					isCorrect: true,
					position: 5,
					matchKey: "p2",
				}),
			],
		});

		expect(
			Answer.grade(
				question,
				Answer.pairs([pair("a", "x"), pair("b", "z"), pair("c", "y")]),
			),
		).toEqual({ earned: 1, possible: 3 });
	});

	test("credits nothing when every pair is crossed", () => {
		expect(
			Answer.grade(
				matching(),
				Answer.pairs([pair("en-cat", "ua-dog"), pair("en-dog", "ua-cat")]),
			),
		).toEqual({ earned: 0, possible: 2 });
	});

	test("grades every other type as a whole", () => {
		const question = singleChoice();
		const [correct] = idsOf(question);

		expect(Answer.grade(question, Answer.options([correct as never]))).toEqual({
			earned: 1,
			possible: 1,
		});
	});
});

describe("isFullyCorrect", () => {
	test("is true only when every unit is earned", () => {
		expect(Answer.isFullyCorrect({ earned: 2, possible: 2 })).toBe(true);
		expect(Answer.isFullyCorrect({ earned: 1, possible: 2 })).toBe(false);
		expect(Answer.isFullyCorrect({ earned: 0, possible: 2 })).toBe(false);
	});

	test("a partly correct matching answer is not correct", () => {
		const question = matching();
		const answer = Answer.pairs([
			[toQuestionOptionId("en-cat"), toQuestionOptionId("ua-cat")],
			[toQuestionOptionId("en-dog"), toQuestionOptionId("ua-cat")],
		]);

		expect(Answer.grade(question, answer).earned).toBeGreaterThan(0);
		expect(Answer.evaluate(question, answer)).toBe(false);
	});
});
