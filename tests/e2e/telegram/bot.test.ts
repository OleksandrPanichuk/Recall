import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { QuestionType } from "@/domain/quiz-set/question";
import {
	ALLOWED_USER,
	aQuestionInput,
	type BotHarness,
	createBotHarness,
	OTHER_USER,
	seedPublishedSet,
} from "./bot-harness";

let harness: BotHarness;

beforeEach(() => {
	harness = createBotHarness();
});

afterEach(() => {
	harness.close();
});

const buttonFor = (label: string): string => {
	const found = harness
		.lastButtons()
		.find((entry) => entry.text.includes(label));

	if (found === undefined) {
		throw new Error(
			`no button matching "${label}" in: ${harness
				.lastButtons()
				.map((entry) => entry.text)
				.join(" | ")}`,
		);
	}

	return found.callback_data;
};

async function openSet(title: string): Promise<void> {
	await harness.send("/start");
	await harness.tap(buttonFor("Мої набори"));
	await harness.tap(buttonFor(title));
}

describe("allowlist (§3.1)", () => {
	test("an unknown user gets a refusal and no menu", async () => {
		await harness.send("/start", OTHER_USER);

		expect(harness.lastText()).toBe("Цей бот приватний.");
		expect(harness.lastButtons()).toEqual([]);
	});

	test("an unknown user cannot drive a callback", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await harness.send("/start");
		const setsButton = buttonFor("Мої набори");

		await harness.tap(setsButton, OTHER_USER);

		expect(harness.answeredQueries()).toContain("Доступ заборонено");
	});

	test("the allowed user reaches the menu", async () => {
		await harness.send("/start", ALLOWED_USER);

		expect(harness.lastText()).toContain("Головне меню");
	});
});

describe("navigation shell (§3.2)", () => {
	test("the menu offers every planned entry", async () => {
		await harness.send("/start");

		const labels = harness.lastButtons().map((entry) => entry.text);

		expect(labels).toEqual([
			expect.stringContaining("Мої набори"),
			expect.stringContaining("Продовжити навчання"),
			expect.stringContaining("Повторити помилки"),
			expect.stringContaining("Слабкі теми"),
			expect.stringContaining("Статистика"),
			expect.stringContaining("Налаштування"),
		]);
	});

	test("an empty library says so instead of erroring", async () => {
		await harness.send("/start");

		await harness.tap(buttonFor("Мої набори"));

		expect(harness.lastText()).toContain("Опублікованих наборів ще немає");
	});

	test("listing shows published sets with their question counts", async () => {
		await seedPublishedSet(harness, "Bun", [
			aQuestionInput("One"),
			aQuestionInput("Two"),
		]);
		await harness.send("/start");

		await harness.tap(buttonFor("Мої набори"));

		expect(harness.lastButtons()[0]?.text).toBe("Bun (2)");
	});

	test("Налаштування routes to a placeholder", async () => {
		await harness.send("/start");

		await harness.tap(buttonFor("Налаштування"));

		expect(harness.lastText()).toContain("Phase 6");
	});

	test("resume without an attempt explains rather than failing", async () => {
		await harness.send("/start");

		await harness.tap(buttonFor("Продовжити навчання"));

		expect(harness.lastText()).toContain("Немає незавершеної спроби");
	});

	test("an unparsable callback is rejected", async () => {
		await harness.send("/start");

		await harness.tap("not-a-real-callback");

		expect(harness.answeredQueries()).toContain("Незрозуміла дія");
	});
});

describe("quiz flow (§3.3)", () => {
	test("opening a set shows the first question", async () => {
		await seedPublishedSet(harness, "Bun", [
			aQuestionInput("One"),
			aQuestionInput("Two"),
		]);

		await openSet("Bun");

		expect(harness.lastText()).toContain("питання 1/2");
		expect(harness.lastText()).toContain("One");
	});

	// §3.3 gate: the payload must carry stable ids, never the answer.
	test("the option payloads do not reveal which is correct", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);

		await openSet("Bun");
		const options = harness
			.lastButtons()
			.filter((entry) => entry.text.includes("for One"));

		expect(options).toHaveLength(2);
		for (const option of options) {
			expect(option.callback_data).toMatch(/^a:q\d{17}:\d+$/);
		}
		// Both payloads differ only by option position — nothing marks correctness.
		expect(
			options.map((option) => option.callback_data.split(":").slice(0, 2)),
		).toEqual([
			[expect.any(String), expect.any(String)],
			[expect.any(String), expect.any(String)],
		]);
	});

	test("the question screen withholds the explanation until answered", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);

		await openSet("Bun");

		expect(harness.lastText()).not.toContain("Explanation for One");

		harness.clock.advance(60_000);
		await harness.tap(buttonFor("Right for One"));

		expect(harness.lastText()).toContain("Explanation for One");
	});

	test("a correct answer reports the score and offers the next question", async () => {
		await seedPublishedSet(harness, "Bun", [
			aQuestionInput("One"),
			aQuestionInput("Two"),
		]);
		await openSet("Bun");
		harness.clock.advance(60_000);

		await harness.tap(buttonFor("Right for One"));

		expect(harness.lastText()).toContain("✅ Правильно");
		expect(harness.lastText()).toContain("1/2 (50%)");
		expect(buttonFor("Далі")).toBe("r");
	});

	test("a wrong answer names the correct option", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await openSet("Bun");
		harness.clock.advance(60_000);

		await harness.tap(buttonFor("Wrong for One"));

		expect(harness.lastText()).toContain("❌ Неправильно");
		expect(harness.lastText()).toContain("Правильна відповідь: Right for One");
	});

	// §3.3 gate: a duplicated or stale callback must not score twice.
	test("tapping the same answer twice does not move the score", async () => {
		await seedPublishedSet(harness, "Bun", [
			aQuestionInput("One"),
			aQuestionInput("Two"),
		]);
		await openSet("Bun");
		harness.clock.advance(60_000);
		const payload = buttonFor("Right for One");
		await harness.tap(payload);

		await harness.tap(payload);

		expect(harness.lastText()).toContain("1/2 (50%)");
		expect(harness.lastText()).toContain("уже зарахована раніше");
	});

	test("a stale wrong-answer payload cannot overwrite a recorded answer", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await openSet("Bun");
		harness.clock.advance(60_000);
		const wrong = buttonFor("Wrong for One");
		const right = buttonFor("Right for One");
		await harness.tap(wrong);

		await harness.tap(right);

		expect(harness.lastText()).toContain("❌ Неправильно");
	});

	test("progress survives a restart", async () => {
		await seedPublishedSet(harness, "Bun", [
			aQuestionInput("One"),
			aQuestionInput("Two"),
		]);
		await openSet("Bun");
		harness.clock.advance(60_000);
		await harness.tap(buttonFor("Right for One"));

		await harness.send("/start");
		await harness.tap(buttonFor("Продовжити навчання"));

		expect(harness.lastText()).toContain("питання 2/2");
	});

	test("a multiple choice question toggles before submitting", async () => {
		await seedPublishedSet(harness, "Bun", [
			aQuestionInput("Multi", {
				type: QuestionType.MultipleChoice,
				options: [
					{ text: "Alpha", isCorrect: true },
					{ text: "Beta", isCorrect: true },
					{ text: "Gamma", isCorrect: false },
				],
			}),
		]);
		await openSet("Bun");

		await harness.tap(buttonFor("Alpha"));

		expect(buttonFor("Alpha")).toContain("t:");
		expect(harness.lastButtons()[0]?.text).toBe("☑️ Alpha");

		await harness.tap(buttonFor("Beta"));
		harness.clock.advance(60_000);
		await harness.tap(buttonFor("Відповісти"));

		expect(harness.lastText()).toContain("✅ Правильно");
	});
});

describe("results and statistics (§3.4)", () => {
	test("finishing shows the final score and reaches statistics", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await openSet("Bun");
		harness.clock.advance(60_000);
		await harness.tap(buttonFor("Right for One"));
		harness.clock.advance(60_000);

		await harness.tap(buttonFor("Завершити"));

		expect(harness.lastText()).toContain("Спробу завершено");
		expect(harness.lastText()).toContain("1/1 (100%)");

		await harness.tap(buttonFor("Статистика"));
		await harness.tap(buttonFor("Bun"));

		expect(harness.lastText()).toContain("Точність по набору: 1/1 (100%)");
	});

	test("statistics for a set with no attempts says so", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await harness.send("/start");

		await harness.tap(buttonFor("Статистика"));
		await harness.tap(buttonFor("Bun"));

		expect(harness.lastText()).toContain("Завершених спроб ще немає");
	});

	test("statistics report topic accuracy and improvement across attempts", async () => {
		await seedPublishedSet(harness, "Bun", [
			aQuestionInput("One", { topic: "Alpha" }),
		]);
		await openSet("Bun");
		harness.clock.advance(60_000);
		await harness.tap(buttonFor("Wrong for One"));
		harness.clock.advance(60_000);
		await harness.tap(buttonFor("Завершити"));

		await openSet("Bun");
		harness.clock.advance(60_000);
		await harness.tap(buttonFor("Right for One"));
		harness.clock.advance(60_000);
		await harness.tap(buttonFor("Завершити"));

		await harness.send("/start");
		await harness.tap(buttonFor("Статистика"));
		await harness.tap(buttonFor("Bun"));

		expect(harness.lastText()).toContain("Прогрес: 0% → 100% (+100)");
		expect(harness.lastText()).toContain("• Alpha: 1/2");
	});
});

describe("adaptive practice (§5)", () => {
	const missOneQuestion = async (topic?: string): Promise<void> => {
		await seedPublishedSet(harness, "Bun", [
			aQuestionInput("One", topic === undefined ? {} : { topic }),
			aQuestionInput("Two", topic === undefined ? {} : { topic }),
			aQuestionInput("Three", topic === undefined ? {} : { topic }),
		]);
		await openSet("Bun");

		for (const prompt of ["One", "Two", "Three"]) {
			harness.clock.advance(60_000);
			await harness.tap(buttonFor(`Wrong for ${prompt}`));
			harness.clock.advance(60_000);
			await harness.tap(buttonFor(prompt === "Three" ? "Завершити" : "Далі"));
		}
	};

	test("a wrong answer offers a rating", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await openSet("Bun");
		harness.clock.advance(60_000);

		await harness.tap(buttonFor("Wrong for One"));

		expect(buttonFor("Важко")).toContain("v:");
		expect(harness.lastButtons().map((entry) => entry.text)).toEqual(
			expect.arrayContaining(["😖 Важко", "🙂 Нормально", "😎 Легко"]),
		);
	});

	test("a correct answer offers no rating", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await openSet("Bun");
		harness.clock.advance(60_000);

		await harness.tap(buttonFor("Right for One"));

		expect(
			harness.lastButtons().some((entry) => entry.text.includes("Важко")),
		).toBe(false);
	});

	// The router already answered this callback query, so the confirmation has to
	// be a screen: Telegram rejects a second answer for the same query.
	test("rating a question confirms its next review date on screen", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await openSet("Bun");
		harness.clock.advance(60_000);
		await harness.tap(buttonFor("Wrong for One"));

		await harness.tap(buttonFor("Легко"));

		expect(harness.lastText()).toContain("Заплановано повторення на");
	});

	test("answers each callback query exactly once", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await openSet("Bun");
		harness.clock.advance(60_000);
		await harness.tap(buttonFor("Wrong for One"));
		const before = harness.calls.filter(
			(call) => call.method === "answerCallbackQuery",
		).length;

		await harness.tap(buttonFor("Важко"));

		const after = harness.calls.filter(
			(call) => call.method === "answerCallbackQuery",
		).length;

		expect(after - before).toBe(1);
	});

	test("the mistakes menu opens a session once questions are due", async () => {
		await missOneQuestion();
		harness.clock.advance(2 * 24 * 60 * 60 * 1000);
		await harness.send("/start");

		await harness.tap(buttonFor("Повторити помилки"));

		expect(harness.lastText()).toContain("Повторення помилок");
		expect(harness.lastText()).toContain("питання 1/3");
	});

	test("the mistakes menu says so when nothing is due", async () => {
		await harness.send("/start");

		await harness.tap(buttonFor("Повторити помилки"));

		expect(harness.lastText()).toContain("немає питань для повторення");
	});

	test("the weak-topics menu opens a session for the weakest topic", async () => {
		await missOneQuestion("Alpha");
		await harness.send("/start");

		await harness.tap(buttonFor("Слабкі теми"));

		expect(harness.lastText()).toContain("Слабка тема: Alpha");
	});

	test("the weak-topics menu says so without enough history", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await harness.send("/start");

		await harness.tap(buttonFor("Слабкі теми"));

		expect(harness.lastText()).toContain("Замало відповідей");
	});
});

// The harness now enforces Telegram's real limits and can reject a call the way
// the API does, so these are the failures that used to be invisible.
describe("real API limits and failures", () => {
	test("statistics stay inside the message limit after many attempts", async () => {
		await seedPublishedSet(harness, "Bun", [
			aQuestionInput("One", { topic: "A".repeat(100) }),
		]);

		for (let round = 0; round < 40; round += 1) {
			await openSet("Bun");
			harness.clock.advance(60_000);
			await harness.tap(buttonFor("Right for One"));
			harness.clock.advance(60_000);
			await harness.tap(buttonFor("Завершити"));
		}

		await harness.send("/start");
		await harness.tap(buttonFor("Статистика"));
		await harness.tap(buttonFor("Bun"));

		expect(harness.lastText().length).toBeLessThanOrEqual(4096);
		expect(harness.lastText()).toContain("і ще");
	});

	test("a long question and explanation stay inside the message limit", async () => {
		await seedPublishedSet(harness, "Bun", [
			aQuestionInput("One", {
				prompt: "П".repeat(1000),
				explanation: "Я".repeat(1000),
				options: [
					{ text: "Т".repeat(300), isCorrect: true },
					{ text: "Н".repeat(300), isCorrect: false },
				],
			}),
		]);

		await openSet("Bun");

		expect(harness.lastText().length).toBeLessThanOrEqual(4096);

		harness.clock.advance(60_000);
		await harness.tap(harness.lastButtons()[0]?.callback_data as string);

		expect(harness.lastText().length).toBeLessThanOrEqual(4096);
	});

	// Telegraf's default error handler rethrows, which aborts polling and exits
	// the process. A transient API failure must not end the session.
	test("an API failure mid-render does not escape the middleware", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await harness.send("/start");
		harness.failNext({
			method: "editMessageText",
			message: "429: Too Many Requests: retry after 1",
		});

		await harness.tap(buttonFor("Мої набори"));

		// The tap failed, but the bot is still answering.
		await harness.tap(buttonFor("« Меню"));

		expect(harness.lastText()).toContain("Головне меню");
	});

	test("an uneditable message falls back to a fresh one", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await harness.send("/start");
		harness.failNext({
			method: "editMessageText",
			message: "400: Bad Request: message to edit not found",
		});

		await harness.tap(buttonFor("Мої набори"));

		// A fresh message was sent rather than the edit failing the session.
		expect(harness.calls.at(-1)?.method).toBe("sendMessage");
		expect(harness.lastText()).toContain("Оберіть набір");
		expect(buttonFor("Bun")).toContain("s:");
	});
});

// Answering the last question and then tapping "« Меню" instead of "🏁 Завершити"
// used to leave an attempt that blocked every other action, on a screen that no
// longer offered any way to finish it. It needed a hand-written UPDATE to escape.
describe("finishing an answered-out attempt", () => {
	const answerEverything = async (): Promise<void> => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await openSet("Bun");
		harness.clock.advance(60_000);
		await harness.tap(buttonFor("Right for One"));
	};

	test("the menu offers a way to finish, and says the attempt is done", async () => {
		await answerEverything();

		await harness.tap(buttonFor("Меню"));

		expect(harness.lastText()).toContain("залишилось її завершити");
		expect(buttonFor("Завершити спробу")).toBe("f");
	});

	test("the owner can still start another set afterwards", async () => {
		await answerEverything();
		await harness.tap(buttonFor("Меню"));
		harness.clock.advance(60_000);

		await harness.tap(buttonFor("Завершити спробу"));

		expect(harness.lastText()).toContain("Спробу завершено");

		await seedPublishedSet(harness, "Second", [aQuestionInput("Two")]);
		await harness.tap(buttonFor("Меню"));
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("Second"));

		expect(harness.lastText()).toContain("питання 1/1");
	});

	test("continuing offers finishing rather than claiming nothing is open", async () => {
		await answerEverything();
		await harness.tap(buttonFor("Меню"));

		await harness.tap(buttonFor("Продовжити навчання"));

		expect(harness.lastText()).toContain("Усі питання пройдено");
		expect(buttonFor("Завершити")).toBe("f");
	});

	test("reopening the same set offers finishing too", async () => {
		await answerEverything();
		await harness.tap(buttonFor("Меню"));
		await harness.tap(buttonFor("Мої набори"));

		await harness.tap(buttonFor("Bun"));

		expect(buttonFor("Завершити")).toBe("f");
	});
});
