import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { CurrentQuestionView, Question } from "@recall/contracts";
import { QuestionType } from "@recall/contracts";
import { shuffled } from "@recall/kit/shuffle";

const nativeFetch = globalThis.fetch;

GlobalRegistrator.register({ url: "http://127.0.0.1/" });

const { cleanup, fireEvent, render, screen } = await import(
	"@testing-library/react"
);
const { QuestionCard } = await import("@/components/QuestionCard");

afterEach(() => {
	cleanup();
});

afterAll(async () => {
	globalThis.fetch = nativeFetch;
	await GlobalRegistrator.unregister();
});

const option = (text: string, position: number, isCorrect = false) => ({
	id: `option-${position}`,
	text,
	isCorrect,
	position,
	matchKey: undefined,
});

const aQuestion = (
	type: Question["type"],
	options: Question["options"],
): Question => ({
	id: "question-1",
	type,
	prompt: "Prompt",
	options,
	difficulty: "medium",
	position: 0,
});

const aView = (shuffleOptions = false): CurrentQuestionView => ({
	attemptId: "attempt-1",
	quizSetId: "quiz-1",
	quizSetTitle: "A set",
	status: "active",
	index: 0,
	total: 3,
	awaitingFinish: false,
	shuffleOptions,
	examMode: false,
});

interface Answer {
	readonly selectedOptionPositions?: readonly number[];
	readonly typedAnswer?: string;
}

const optionLabels = (): readonly string[] =>
	screen
		.getAllByRole("button")
		.map((element) => (element.textContent ?? "").trim())
		.filter(
			(text) =>
				text.length > 0 &&
				text !== "Показати відповідь" &&
				text !== "Відповісти" &&
				text !== "Скинути",
		);

const mount = (question: Question, view = aView()) => {
	const answers: Answer[] = [];

	render(
		<QuestionCard
			view={view}
			question={question}
			disabled={false}
			onAnswer={(answer) => answers.push(answer)}
		/>,
	);

	return answers;
};

describe("single choice", () => {
	test("answers on the first click", () => {
		const answers = mount(
			aQuestion(QuestionType.SingleChoice, [
				option("Right", 0, true),
				option("Wrong", 1),
			]),
		);

		fireEvent.click(screen.getByText("Right"));

		expect(answers).toEqual([{ selectedOptionPositions: [0] }]);
	});
});

describe("multiple choice", () => {
	test("collects a set and answers once, on submit", () => {
		const answers = mount(
			aQuestion(QuestionType.MultipleChoice, [
				option("First", 0, true),
				option("Second", 1, true),
				option("Third", 2),
			]),
		);

		fireEvent.click(screen.getByText("First"));
		fireEvent.click(screen.getByText("Second"));

		expect(answers).toEqual([]);

		fireEvent.click(screen.getByRole("button", { name: "Відповісти" }));

		expect(answers).toEqual([{ selectedOptionPositions: [0, 1] }]);
	});

	test("a second click takes an option back out", () => {
		const answers = mount(
			aQuestion(QuestionType.MultipleChoice, [
				option("First", 0, true),
				option("Second", 1),
			]),
		);

		fireEvent.click(screen.getByText("First"));
		fireEvent.click(screen.getByText("Second"));
		fireEvent.click(screen.getByText("Second"));
		fireEvent.click(screen.getByRole("button", { name: "Відповісти" }));

		expect(answers).toEqual([{ selectedOptionPositions: [0] }]);
	});
});

describe("typed answer", () => {
	test("offers a field rather than a dead end, and sends the text", () => {
		const answers = mount(
			aQuestion(QuestionType.TypedAnswer, [option("write-ahead log", 0, true)]),
		);
		const field = screen.getByPlaceholderText("Ваша відповідь");

		fireEvent.change(field, { target: { value: "  write-ahead log  " } });
		fireEvent.click(screen.getByRole("button", { name: "Відповісти" }));

		expect(answers).toEqual([{ typedAnswer: "write-ahead log" }]);
	});

	test("will not send an empty answer", () => {
		const answers = mount(aQuestion(QuestionType.Cloze, []));

		fireEvent.click(screen.getByRole("button", { name: "Відповісти" }));

		expect(answers).toEqual([]);
	});
});

describe("ordering", () => {
	const ordered = aQuestion(QuestionType.Ordering, [
		option("First", 0, true),
		option("Second", 1, true),
		option("Third", 2, true),
		option("Fourth", 3, true),
		option("Fifth", 4, true),
	]);

	test("sends the positions in the order they were clicked", () => {
		const answers = mount(ordered);

		for (const label of ["Third", "First", "Fifth", "Second", "Fourth"]) {
			fireEvent.click(screen.getByText(label));
		}

		fireEvent.click(screen.getByRole("button", { name: "Відповісти" }));

		expect(answers).toEqual([{ selectedOptionPositions: [2, 0, 4, 1, 3] }]);
	});

	test("shows them in shuffled order, not the answer's order", () => {
		mount(ordered);

		const expected = shuffled(ordered.options, ordered.id).map(
			(option) => option.text,
		);

		expect(expected).not.toEqual(ordered.options.map((option) => option.text));
		expect(optionLabels()).toEqual(expected);
	});

	test("cannot answer before every option is placed", () => {
		mount(ordered);

		const submit = screen.getByRole("button", {
			name: "Відповісти",
		}) as HTMLButtonElement;

		expect(submit.disabled).toBe(true);
	});
});

describe("matching", () => {
	const pairs = aQuestion(QuestionType.Matching, [
		option("Left one", 0, true),
		option("Left two", 1, true),
		option("Right one", 2, true),
		option("Right two", 3, true),
	]);

	test("sends pairs flattened left, right, left, right", () => {
		const answers = mount(pairs);

		fireEvent.click(screen.getByText("Left two"));
		fireEvent.click(screen.getByText("Right one"));
		fireEvent.click(screen.getByText("Left one"));
		fireEvent.click(screen.getByText("Right two"));
		fireEvent.click(screen.getByRole("button", { name: "Відповісти" }));

		expect(answers).toEqual([{ selectedOptionPositions: [1, 2, 0, 3] }]);
	});

	test("cannot answer with a half-made pair", () => {
		const answers = mount(pairs);

		fireEvent.click(screen.getByText("Left one"));

		const submit = screen.getByRole("button", {
			name: "Відповісти",
		}) as HTMLButtonElement;

		expect(submit.disabled).toBe(true);
		expect(answers).toEqual([]);
	});
});

describe("shuffling the options", () => {
	const question = aQuestion(QuestionType.SingleChoice, [
		option("Alpha", 0, true),
		option("Bravo", 1),
		option("Charlie", 2),
		option("Delta", 3),
	]);

	test("keeps the authored order when the setting is off", () => {
		mount(question);

		expect(optionLabels()).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
	});

	test("uses the bot's seed when the setting is on, so both clients agree", () => {
		mount(question, aView(true));

		const expected = shuffled(question.options, `attempt-1:${question.id}`).map(
			(option) => option.text,
		);

		expect(expected).not.toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
		expect(optionLabels()).toEqual(expected);
	});
});
