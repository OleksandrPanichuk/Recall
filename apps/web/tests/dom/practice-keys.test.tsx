import { afterEach, describe, expect, test } from "bun:test";
import type { Question } from "@recall/contracts";
import { QuestionType } from "@recall/contracts";

const { cleanup, fireEvent, render, screen } = await import(
	"@testing-library/react"
);
const { ChoiceOptions } = await import(
	"@/features/practice/ui/components/ChoiceOptions"
);

afterEach(() => {
	cleanup();
});

const option = (text: string, position: number, isCorrect = false) => ({
	id: `option-${position}`,
	text,
	isCorrect,
	position,
	matchKey: undefined,
});

const aQuestion = (type: Question["type"]): Question => ({
	id: "question-1",
	type,
	prompt: "Prompt",
	options: [option("First", 0, true), option("Second", 1), option("Third", 2)],
	difficulty: "medium",
	position: 0,
});

const mount = (type: Question["type"], disabled = false) => {
	const answers: (readonly number[])[] = [];

	render(
		<ChoiceOptions
			question={aQuestion(type)}
			disabled={disabled}
			onAnswer={(positions) => answers.push(positions)}
		/>,
	);

	return answers;
};

const press = (key: string) => {
	fireEvent.keyDown(document, { key });
};

describe("answering from the keyboard", () => {
	test("a digit picks the option in that place", () => {
		const answers = mount(QuestionType.SingleChoice);

		press("2");

		expect(answers).toEqual([[1]]);
	});

	test("digits toggle a multi-select, and Enter submits the set", () => {
		const answers = mount(QuestionType.MultipleChoice);

		press("1");
		press("3");

		expect(answers).toEqual([]);

		press("Enter");

		expect(answers).toEqual([[0, 2]]);
	});

	test("Enter does nothing while nothing is chosen", () => {
		const answers = mount(QuestionType.MultipleChoice);

		press("Enter");

		expect(answers).toEqual([]);
	});

	test("a digit past the last option is ignored", () => {
		const answers = mount(QuestionType.SingleChoice);

		press("9");

		expect(answers).toEqual([]);
	});

	test("the keys go quiet once the question is answered", () => {
		const answers = mount(QuestionType.SingleChoice, true);

		press("1");

		expect(answers).toEqual([]);
	});

	test("each option shows the digit that picks it", () => {
		mount(QuestionType.SingleChoice);

		expect(screen.getByText("1")).toBeDefined();
		expect(screen.getByText("3")).toBeDefined();
	});
});
