import { describe, expect, test } from "bun:test";
import { ApiErrorName, BotApiError } from "@recall/contracts";
import { errorScreen } from "../src/telegram/presenters/error.presenter";

describe("the refusal to start a second attempt", () => {
	const refusal = new BotApiError(
		ApiErrorName.AttemptAlreadyInProgress,
		"Attempt a on quiz set b is still unfinished; finish or abandon it first",
		409,
		{ attemptId: "a", quizSetId: "b" },
	);

	test("offers both ways out, not just a dead end", () => {
		const screen = errorScreen(refusal);
		const labels = screen.keyboard.flat().map((entry) => entry.text);

		expect(labels).toEqual([
			"▶️ Продовжити ту спробу",
			"🗑 Скасувати спробу",
			"« Меню",
		]);
	});

	test("never leaks the raw message with its ids", () => {
		expect(errorScreen(refusal).text).not.toContain("Attempt a");
		expect(errorScreen(refusal).text).toContain("скасуйте");
	});

	test("any other failure still gets the plain notice", () => {
		const other = new BotApiError(
			ApiErrorName.QuizSetNotFound,
			"nope",
			404,
			{},
		);

		expect(
			errorScreen(other)
				.keyboard.flat()
				.map((entry) => entry.text),
		).toEqual(["« Меню"]);
	});
});
