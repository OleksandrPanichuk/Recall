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

const trigger = () => screen.getByRole("button", { name: /hint/i });

describe("revealing a hint", () => {
	test("offers the trigger and keeps the hint hidden before a click", () => {
		mount("question-1");

		expect(trigger()).not.toBeNull();
		expect(screen.queryByText(HINT)).toBeNull();
	});

	test("shows the hint on a click and keeps the trigger in place", () => {
		mount("question-1");

		fireEvent.click(trigger());

		expect(screen.queryByText(HINT)).not.toBeNull();
		expect(trigger()).not.toBeNull();
	});

	test("hides the hint again on a second click", () => {
		mount("question-1");

		fireEvent.click(trigger());
		fireEvent.click(trigger());

		expect(trigger().getAttribute("aria-expanded")).toBe("false");
	});

	test("a disabled trigger reveals nothing", () => {
		mount("question-1", true);

		fireEvent.click(trigger());

		expect(screen.queryByText(HINT)).toBeNull();
	});

	test("a new key hides the hint again", () => {
		const { rerender } = mount("question-1");

		fireEvent.click(trigger());
		expect(screen.queryByText(HINT)).not.toBeNull();

		rerender(<HintReveal key="question-2" hint={HINT} disabled={false} />);

		expect(screen.queryByText(HINT)).toBeNull();
	});
});
