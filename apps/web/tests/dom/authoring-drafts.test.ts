import { describe, expect, test } from "bun:test";
import { QuestionType } from "@recall/contracts";
import {
	type DraftForm,
	emptyForm,
	problemsWith,
	toDraft,
} from "@/features/authoring/lib/drafts";
import { questionCount } from "@/features/authoring/lib/plurals";

const form = (over: Partial<DraftForm> = {}): DraftForm => ({
	...emptyForm(),
	prompt: "What runs this?",
	answers: ["Bun", "Node"],
	correct: [0],
	...over,
});

describe("what a half-written question is refused for", () => {
	test("an empty prompt", () => {
		expect(problemsWith(form({ prompt: "   " }))).toContain(
			"Питання не може бути порожнім",
		);
	});

	test("a choice question with one answer", () => {
		expect(problemsWith(form({ answers: ["Bun", "  "] }))).toContain(
			"Потрібно щонайменше два варіанти",
		);
	});

	test("a choice question with nothing marked correct", () => {
		expect(problemsWith(form({ correct: [] }))).toContain(
			"Позначте правильну відповідь",
		);
	});

	test("a cloze question whose prompt has no blank", () => {
		expect(
			problemsWith(form({ type: QuestionType.Cloze, prompt: "no blank here" })),
		).toContain("Пропуск позначається як ___");
	});

	test("a cloze question with a blank and an answer is accepted", () => {
		expect(
			problemsWith(
				form({
					type: QuestionType.Cloze,
					prompt: "Bun runs ___ fast",
					answers: ["very"],
				}),
			),
		).toEqual([]);
	});

	test("matching pairs that do not pair up", () => {
		expect(
			problemsWith(
				form({
					type: QuestionType.Matching,
					answers: ["one", "two"],
					rights: ["1", "  "],
				}),
			),
		).toContain("Потрібно щонайменше дві повні пари");
	});

	test("a complete question has nothing to complain about", () => {
		expect(problemsWith(form())).toEqual([]);
	});
});

describe("the shape each type is sent in", () => {
	test("a choice question sends options, and marks the right one", () => {
		expect(toDraft(form())).toEqual({
			type: QuestionType.SingleChoice,
			prompt: "What runs this?",
			difficulty: "easy",
			explanation: undefined,
			hint: undefined,
			options: [
				{ text: "Bun", isCorrect: true },
				{ text: "Node", isCorrect: false },
			],
		});
	});

	test("a typed question sends acceptedAnswers, not options", () => {
		const draft = toDraft(
			form({ type: QuestionType.TypedAnswer, answers: ["Bun", "bun"] }),
		);

		expect(draft).toHaveProperty("acceptedAnswers", ["Bun", "bun"]);
		expect(draft).not.toHaveProperty("options");
	});

	test("an ordering question sends orderedItems in the order given", () => {
		expect(
			toDraft(form({ type: QuestionType.Ordering, answers: ["one", "two"] })),
		).toHaveProperty("orderedItems", ["one", "two"]);
	});

	test("a matching question pairs each left with its right", () => {
		expect(
			toDraft(
				form({
					type: QuestionType.Matching,
					answers: ["one", "two"],
					rights: ["1", "2"],
				}),
			),
		).toHaveProperty("pairs", [
			{ left: "one", right: "1" },
			{ left: "two", right: "2" },
		]);
	});

	test("blank answers are dropped rather than sent empty", () => {
		expect(
			toDraft(form({ answers: ["Bun", "   ", "Node"], correct: [0] })),
		).toHaveProperty("options", [
			{ text: "Bun", isCorrect: true },
			{ text: "Node", isCorrect: false },
		]);
	});

	test("an empty explanation is left out, not sent as an empty string", () => {
		expect(toDraft(form({ explanation: "  " })).explanation).toBeUndefined();
		expect(toDraft(form({ explanation: "because" })).explanation).toBe(
			"because",
		);
	});
});

describe("counting questions in Ukrainian", () => {
	test("one takes the singular", () => {
		expect(questionCount(1)).toBe("1 питання");
		expect(questionCount(21)).toBe("21 питання");
	});

	test("two through four take the same form", () => {
		expect(questionCount(3)).toBe("3 питання");
		expect(questionCount(24)).toBe("24 питання");
	});

	test("five and up, and the teens, take the genitive", () => {
		expect(questionCount(5)).toBe("5 питань");
		expect(questionCount(11)).toBe("11 питань");
		expect(questionCount(14)).toBe("14 питань");
		expect(questionCount(0)).toBe("0 питань");
	});
});

describe("what a fresh form starts as", () => {
	test("nothing is marked correct, so the author has to choose", () => {
		expect(emptyForm().correct).toEqual([]);
		expect(
			problemsWith({ ...emptyForm(), prompt: "q", answers: ["a", "b"] }),
		).toContain("Позначте правильну відповідь");
	});
});
