import { afterEach, describe, expect, test } from "bun:test";

const { cleanup, fireEvent, render, screen } = await import(
	"@testing-library/react"
);
const { HintReveal } = await import(
	"@/features/practice/ui/components/HintReveal"
);

afterEach(() => {
	cleanup();
});

const HINT = "Think of the capital, not the largest city.";

const mount = (key: string, disabled = false) =>
	render(<HintReveal key={key} hint={HINT} disabled={disabled} />);

const showButton = () => screen.queryByRole("button", { name: /show a hint/i });

describe("revealing a hint", () => {
	test("offers the button and keeps the hint hidden before a click", () => {
		mount("question-1");

		expect(showButton()).not.toBeNull();
		expect(screen.queryByText(HINT)).toBeNull();
	});

	test("shows the hint and drops the button after a click", () => {
		mount("question-1");

		fireEvent.click(screen.getByRole("button", { name: /show a hint/i }));

		expect(screen.queryByText(HINT)).not.toBeNull();
		expect(showButton()).toBeNull();
	});

	test("a disabled button reveals nothing", () => {
		mount("question-1", true);

		fireEvent.click(screen.getByRole("button", { name: /show a hint/i }));

		expect(screen.queryByText(HINT)).toBeNull();
		expect(showButton()).not.toBeNull();
	});

	test("a new key hides the hint again", () => {
		const { rerender } = mount("question-1");

		fireEvent.click(screen.getByRole("button", { name: /show a hint/i }));
		expect(screen.queryByText(HINT)).not.toBeNull();

		rerender(<HintReveal key="question-2" hint={HINT} disabled={false} />);

		expect(screen.queryByText(HINT)).toBeNull();
		expect(showButton()).not.toBeNull();
	});
});
