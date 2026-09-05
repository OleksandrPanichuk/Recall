import { describe, expect, test } from "bun:test";
import { type Question, QuestionType } from "@recall/contracts";
import {
	changesFrom,
	type DraftForm,
	emptyForm,
	formFor,
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

describe("loading a stored question back into the form", () => {
	const stored = (
		over: Partial<Question> = {},
		options: Question["options"] = [],
	): Question => ({
		id: "q1",
		type: QuestionType.SingleChoice,
		prompt: "What runs this?",
		difficulty: "easy",
		position: 0,
		options,
		...over,
	});

	const option = (
		text: string,
		position: number,
		isCorrect: boolean,
		matchKey?: string,
	) => ({ id: `o${position}`, text, position, isCorrect, matchKey });

	test("a choice question comes back with the right answer marked", () => {
		const form = formFor(
			stored({}, [option("Bun", 0, false), option("Node", 1, true)]),
		);

		expect(form.answers).toEqual(["Bun", "Node"]);
		expect(form.correct).toEqual([1]);
	});

	test("options are read in stored order, not the order they arrived", () => {
		expect(
			formFor(
				stored({}, [option("second", 1, false), option("first", 0, true)]),
			).answers,
		).toEqual(["first", "second"]);
	});

	test("a typed question comes back as its accepted answers", () => {
		const form = formFor(
			stored({ type: QuestionType.TypedAnswer }, [
				option("Bun", 0, true),
				option("bun", 1, true),
			]),
		);

		expect(form.answers).toEqual(["Bun", "bun"]);
	});

	test("a matching question is regrouped into left and right", () => {
		const form = formFor(
			stored({ type: QuestionType.Matching }, [
				option("one", 0, true, "p0"),
				option("two", 1, true, "p1"),
				option("1", 2, true, "p0"),
				option("2", 3, true, "p1"),
			]),
		);

		expect(form.answers).toEqual(["one", "two"]);
		expect(form.rights).toEqual(["1", "2"]);
	});

	test("a question with no explanation loads a blank, not undefined", () => {
		const form = formFor(stored({}, [option("a", 0, true)]));

		expect(form.explanation).toBe("");
		expect(form.hint).toBe("");
	});

	test("a stored question survives a round trip through the form", () => {
		const draft = toDraft(
			formFor(
				stored({ explanation: "because" }, [
					option("Bun", 0, true),
					option("Node", 1, false),
				]),
			),
		);

		expect(draft).toHaveProperty("options", [
			{ text: "Bun", isCorrect: true },
			{ text: "Node", isCorrect: false },
		]);
		expect(draft.explanation).toBe("because");
	});

	test("an update never carries the type, which cannot change", () => {
		const changes = changesFrom(
			formFor(stored({}, [option("Bun", 0, true), option("Node", 1, false)])),
		);

		expect(changes).not.toHaveProperty("type");
		expect(changes).toHaveProperty("prompt", "What runs this?");
	});

	test("clearing an explanation sends an empty string, so it is actually cleared", () => {
		const form = formFor(
			stored({ explanation: "because" }, [option("a", 0, true)]),
		);

		expect(changesFrom({ ...form, explanation: "" }).explanation).toBe("");
	});
});
