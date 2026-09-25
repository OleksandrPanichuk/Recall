import { describe, expect, test } from "bun:test";
import { followedBy } from "./typed-question.presenter";
import { clamped, TELEGRAM_TEXT_LIMIT } from "./utils/text-limit";

const next = {
	text: ["Питання 2", "", "1. Перший варіант", "2. Останній варіант"].join(
		"\n",
	),
	keyboard: [],
};

describe("feedback followed by the next question", () => {
	test("short feedback is kept whole", () => {
		const screen = followedBy({ text: "✅ Правильно", keyboard: [] }, next);

		expect(screen.text).toStartWith("✅ Правильно");
		expect(screen.text).toEndWith(next.text);
	});

	test("long feedback is shortened so the next question survives whole", () => {
		const screen = followedBy({ text: "Я".repeat(5000), keyboard: [] }, next);

		expect(screen.text.length).toBeLessThanOrEqual(TELEGRAM_TEXT_LIMIT);
		expect(clamped(screen.text)).toEndWith("2. Останній варіант");
	});

	test("a next question too long for any feedback carries no stray divider", () => {
		const screen = followedBy(
			{ text: "✅ Правильно", keyboard: [] },
			{ text: "П".repeat(5000), keyboard: [] },
		);

		expect(screen.text).toStartWith("П");
	});
});
