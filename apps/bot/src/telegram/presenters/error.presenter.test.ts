import { describe, expect, test } from "bun:test";
import {
	ApiErrorName,
	BotApiError,
	BotApiUnreachableError,
} from "@recall/contracts";
import { userMessageFor } from "./error.presenter";

const GENERIC = "Сталася помилка. Спробуйте ще раз.";

const refusal = (name: string): BotApiError =>
	new BotApiError(name, "raw api message with ids", 409, {});

describe("userMessageFor", () => {
	const named: readonly [string, string][] = [
		[ApiErrorName.NothingDue, "повторювати"],
		[ApiErrorName.QuestionNotFound, "Питання"],
		[ApiErrorName.AttemptAlreadyFinished, "завершено"],
		[ApiErrorName.QuizAttemptTransition, "Спроба"],
		[ApiErrorName.DuplicateResponse, "вже"],
		[ApiErrorName.Unauthenticated, "/login"],
	];

	for (const [name, fragment] of named) {
		test(`${name} gets its own text`, () => {
			const text = userMessageFor(refusal(name));

			expect(text).not.toBe(GENERIC);
			expect(text).toContain(fragment);
			expect(text).not.toContain("raw api message");
		});
	}

	test("an api that cannot be reached is said to be unavailable", () => {
		const text = userMessageFor(
			new BotApiUnreachableError(
				"http://127.0.0.1:3000/bot/x",
				new Error("refused"),
			),
		);

		expect(text).not.toBe(GENERIC);
		expect(text).toContain("недоступний");
		expect(text).not.toContain("127.0.0.1");
	});

	test("an unknown refusal still gets the generic text", () => {
		expect(userMessageFor(refusal("SomethingNewError"))).toBe(GENERIC);
	});
});
