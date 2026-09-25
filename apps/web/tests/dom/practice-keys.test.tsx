import { afterEach, describe, expect, test } from "bun:test";
import type { Question } from "@recall/contracts";
import { QuestionType } from "@recall/contracts";

const { cleanup, fireEvent, render, renderHook, screen } = await import(
	"@testing-library/react"
);
const { usePracticeKeys } = await import(
	"@/features/practice/hooks/use-practice-keys"
);
const { RecallButtons } = await import(
	"@/features/practice/ui/components/RecallButtons"
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

	test("Enter on a clicked option still submits a multi-select", () => {
		const answers = mount(QuestionType.MultipleChoice);
		const first = screen.getByText("First").closest("button") as HTMLElement;
		const third = screen.getByText("Third").closest("button") as HTMLElement;

		fireEvent.click(first);
		fireEvent.click(third);
		third.focus();
		fireEvent.keyDown(third, { key: "Enter" });

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

describe("Enter to move on", () => {
	const advancing = () => {
		let advanced = 0;

		renderHook(() =>
			usePracticeKeys({
				optionCount: 0,
				onPick: () => undefined,
				onAdvance: () => {
					advanced += 1;
				},
			}),
		);

		return () => advanced;
	};

	const enterOn = (target: Element) =>
		fireEvent.keyDown(target, { key: "Enter" });

	test("moves on when nothing in particular has focus", () => {
		const advanced = advancing();

		enterOn(document.body);

		expect(advanced()).toBe(1);
	});

	test("leaves Enter to a focused button, so a rating is sent rather than skipped", () => {
		const advanced = advancing();

		render(
			<button type="button" onClick={() => undefined}>
				Good
			</button>,
		);

		const button = screen.getByText("Good");

		button.focus();

		expect(enterOn(button)).toBe(true);
		expect(advanced()).toBe(0);
	});

	test("leaves Enter to a link and a select", () => {
		const advanced = advancing();

		render(
			<>
				<a href="/somewhere">Elsewhere</a>
				<select aria-label="Pick">
					<option>One</option>
				</select>
			</>,
		);

		enterOn(screen.getByText("Elsewhere"));
		enterOn(screen.getByLabelText("Pick"));

		expect(advanced()).toBe(0);
	});

	test("still moves on from a button that can no longer be pressed", () => {
		const advanced = advancing();

		render(
			<button type="button" disabled>
				Answered
			</button>,
		);

		enterOn(screen.getByText("Answered"));

		expect(advanced()).toBe(1);
	});
});

describe("the recall rating", () => {
	test("tells assistive tech which rating was chosen", () => {
		render(
			<RecallButtons chosen="good" busy={false} onRate={async () => {}} />,
		);

		const pressed = screen
			.getAllByRole("button")
			.filter((button) => button.getAttribute("aria-pressed") === "true");

		expect(pressed).toHaveLength(1);
		expect(pressed[0]?.textContent).toContain("Good");
	});
});
