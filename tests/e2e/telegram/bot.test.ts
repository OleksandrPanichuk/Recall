import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { QuestionType } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	ALLOWED_USER,
	aQuestionInput,
	type BotHarness,
	createBotHarness,
	OTHER_USER,
	seedFolderPath,
	seedPublishedSet,
	seedPublishedSetIn,
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
			expect.stringContaining("Продовжити навчання"),
			expect.stringContaining("Мої набори"),
			expect.stringContaining("Повторення"),
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

		expect(harness.lastButtons()[0]?.text).toBe("📘 Bun (2)");
	});

	test("Налаштування opens the two scopes", async () => {
		await harness.send("/start");

		await harness.tap(buttonFor("Налаштування"));

		expect(harness.lastButtons().map((entry) => entry.text)).toEqual([
			expect.stringContaining("Загальні"),
			expect.stringContaining("Для набору"),
			expect.stringContaining("Меню"),
		]);
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

		expect(harness.lastText()).toContain("Статистика — Bun");
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

describe("callback acknowledgement", () => {
	test("answers each callback query exactly once", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await openSet("Bun");
		harness.clock.advance(60_000);
		await harness.tap(buttonFor("Wrong for One"));
		const before = harness.calls.filter(
			(call) => call.method === "answerCallbackQuery",
		).length;

		await harness.tap(buttonFor("Завершити"));

		const after = harness.calls.filter(
			(call) => call.method === "answerCallbackQuery",
		).length;

		expect(after - before).toBe(1);
	});
});

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

	test("an API failure mid-render does not escape the middleware", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await harness.send("/start");
		harness.failNext({
			method: "editMessageText",
			message: "429: Too Many Requests: retry after 1",
		});

		await harness.tap(buttonFor("Мої набори"));

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

		expect(harness.calls.at(-1)?.method).toBe("sendMessage");
		expect(harness.lastText()).toContain("Оберіть набір");
		expect(buttonFor("Bun")).toContain("s:");
	});
});

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

describe("long option text stays readable", () => {
	const longOption =
		"Це був просто вдалий хештег у Twitter для мітапу про open source distributed non-relational бази даних у 2009 році";

	test("long options move into the body and buttons become numbers", async () => {
		await seedPublishedSet(harness, "Bun", [
			aQuestionInput("One", {
				options: [
					{ text: longOption, isCorrect: true },
					{ text: `${longOption} (варіант два)`, isCorrect: false },
				],
			}),
		]);

		await openSet("Bun");

		expect(harness.lastText()).toContain(longOption);
		expect(harness.lastText()).toContain("1. ");
		expect(harness.lastText()).toContain("2. ");

		const optionButtons = harness
			.lastButtons()
			.filter((entry) => entry.callback_data.startsWith("a:"));

		expect(optionButtons.map((entry) => entry.text)).toEqual(["1", "2"]);
		for (const entry of optionButtons) {
			expect(entry.text.length).toBeLessThanOrEqual(4);
		}
	});

	test("answering by number still records the right option", async () => {
		await seedPublishedSet(harness, "Bun", [
			aQuestionInput("One", {
				options: [
					{ text: `${longOption} — правильна`, isCorrect: true },
					{ text: `${longOption} — хибна`, isCorrect: false },
				],
			}),
		]);
		await openSet("Bun");
		harness.clock.advance(60_000);

		await harness.tap(buttonFor("1"));

		expect(harness.lastText()).toContain("✅ Правильно");
	});

	test("short options keep their text on the button", async () => {
		await seedPublishedSet(harness, "Bun", [
			aQuestionInput("One", {
				type: QuestionType.TrueFalse,
				options: [
					{ text: "Так", isCorrect: true },
					{ text: "Ні", isCorrect: false },
				],
			}),
		]);

		await openSet("Bun");

		expect(harness.lastButtons().map((entry) => entry.text)).toEqual(
			expect.arrayContaining(["Так", "Ні"]),
		);
	});

	test("a long multiple choice shows its selection in the body", async () => {
		await seedPublishedSet(harness, "Bun", [
			aQuestionInput("Multi", {
				type: QuestionType.MultipleChoice,
				options: [
					{ text: `${longOption} A`, isCorrect: true },
					{ text: `${longOption} B`, isCorrect: true },
					{ text: `${longOption} C`, isCorrect: false },
				],
			}),
		]);
		await openSet("Bun");

		await harness.tap(buttonFor("1"));

		expect(harness.lastText()).toContain("☑️ 1.");
		expect(harness.lastText()).toContain("⬜️ 2.");
	});
});

describe("browsing the folder tree (§3.7)", () => {
	const openRoot = async (): Promise<void> => {
		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
	};

	test("the root lists folders and unfiled sets", async () => {
		await seedFolderPath(harness, ["English"]);
		await seedPublishedSet(harness, "Loose set", [aQuestionInput("One")]);

		await openRoot();

		const labels = harness.lastButtons().map((entry) => entry.text);

		expect(labels).toContainEqual(expect.stringContaining("English"));
		expect(labels).toContainEqual(expect.stringContaining("Loose set"));
	});

	test("a set filed in a folder is not shown at the root", async () => {
		await seedPublishedSetIn(harness, ["English"], "Filed set", [
			aQuestionInput("One"),
		]);

		await openRoot();

		expect(harness.lastButtons().map((entry) => entry.text)).not.toContainEqual(
			expect.stringContaining("Filed set"),
		);
	});

	test("a folder whose sets sit deeper is not badged as empty", async () => {
		await seedPublishedSetIn(
			harness,
			["English", "Vocabulary", "By levels"],
			"A1 words",
			[aQuestionInput("One")],
		);

		await openRoot();

		expect(harness.lastButtons().map((entry) => entry.text)).toContainEqual(
			"📁 English (1)",
		);
	});

	test("a folder badge adds its subfolders to its own sets", async () => {
		await seedPublishedSetIn(harness, ["English"], "A1 words", [
			aQuestionInput("One"),
		]);
		await seedFolderPath(harness, ["English", "Vocabulary"]);

		await openRoot();

		expect(harness.lastButtons().map((entry) => entry.text)).toContainEqual(
			"📁 English (2)",
		);
	});

	test("the root has no back button, only the menu", async () => {
		await seedFolderPath(harness, ["English"]);

		await openRoot();

		const labels = harness.lastButtons().map((entry) => entry.text);

		expect(labels).toContainEqual(expect.stringContaining("Меню"));
		expect(labels).not.toContainEqual(expect.stringContaining("Назад"));
	});

	test("tapping a folder descends and shows the breadcrumb", async () => {
		await seedPublishedSetIn(harness, ["English", "Vocabulary"], "A1 words", [
			aQuestionInput("One"),
		]);

		await openRoot();
		await harness.tap(buttonFor("English"));
		await harness.tap(buttonFor("Vocabulary"));

		expect(harness.lastText()).toContain("English");
		expect(harness.lastText()).toContain("Vocabulary");
		expect(harness.lastButtons().map((entry) => entry.text)).toContainEqual(
			expect.stringContaining("A1 words"),
		);
	});

	test("back returns to the parent, and from a root folder to the root", async () => {
		await seedFolderPath(harness, ["English", "Vocabulary"]);
		await seedPublishedSet(harness, "Loose set", [aQuestionInput("One")]);

		await openRoot();
		await harness.tap(buttonFor("English"));
		await harness.tap(buttonFor("Vocabulary"));
		await harness.tap(buttonFor("Назад"));

		expect(harness.lastButtons().map((entry) => entry.text)).toContainEqual(
			expect.stringContaining("Vocabulary"),
		);

		await harness.tap(buttonFor("Назад"));

		expect(harness.lastButtons().map((entry) => entry.text)).toContainEqual(
			expect.stringContaining("Loose set"),
		);
	});

	test("a set inside a folder starts an attempt", async () => {
		await seedPublishedSetIn(harness, ["English"], "A1 words", [
			aQuestionInput("Capital of France?"),
		]);

		await openRoot();
		await harness.tap(buttonFor("English"));
		await harness.tap(buttonFor("A1 words"));

		expect(harness.lastText()).toContain("Capital of France?");
	});

	test("an empty folder says so and offers a way back", async () => {
		await seedFolderPath(harness, ["English"]);

		await openRoot();
		await harness.tap(buttonFor("English"));

		expect(harness.lastText()).toContain("порожня");
		expect(harness.lastButtons().map((entry) => entry.text)).toContainEqual(
			expect.stringContaining("Назад"),
		);
	});

	test("more than eight entries paginate", async () => {
		for (let index = 0; index < 11; index += 1) {
			await seedPublishedSetIn(
				harness,
				["English"],
				`Set ${String(index).padStart(2, "0")}`,
				[aQuestionInput(`Q${index}`)],
			);
		}

		await openRoot();
		await harness.tap(buttonFor("English"));

		const first = harness.lastButtons().map((entry) => entry.text);

		expect(first.filter((label) => label.includes("Set "))).toHaveLength(8);

		await harness.tap(buttonFor("Наступні"));

		const second = harness.lastButtons().map((entry) => entry.text);

		expect(second.filter((label) => label.includes("Set "))).toHaveLength(3);
		expect(second).toContainEqual(expect.stringContaining("Попередні"));
	});

	test("a long folder name is truncated on the button but whole in the body", async () => {
		const longName = "Дуже довга назва папки яка точно не вміщується";
		await seedFolderPath(harness, [longName]);

		await openRoot();

		const label = harness
			.lastButtons()
			.map((entry) => entry.text)
			.find((text) => text.includes("Дуже довга"));

		expect(label?.length).toBeLessThanOrEqual(34);
		expect(harness.lastText()).toContain(longName);
	});

	test("a truncated label stays valid UTF-16 when an emoji straddles the cut", async () => {
		const longName = "Англійська для початківців 🚀 базова";
		await seedFolderPath(harness, [longName]);

		await openRoot();

		const label = harness
			.lastButtons()
			.map((entry) => entry.text)
			.find((text) => text.includes("Англійська"));

		expect(label?.isWellFormed()).toBe(true);
		expect(harness.lastText()).toContain(longName);
	});

	test("unfiled sets at the root paginate", async () => {
		for (let index = 0; index < 11; index += 1) {
			await seedPublishedSet(
				harness,
				`Root ${String(index).padStart(2, "0")}`,
				[aQuestionInput(`Q${index}`)],
			);
		}

		await openRoot();

		expect(
			harness
				.lastButtons()
				.map((entry) => entry.text)
				.filter((label) => label.includes("Root ")),
		).toHaveLength(8);

		await harness.tap(buttonFor("Наступні"));

		const second = harness.lastButtons().map((entry) => entry.text);

		expect(second.filter((label) => label.includes("Root "))).toHaveLength(3);

		await harness.tap(buttonFor("Попередні"));

		expect(
			harness
				.lastButtons()
				.map((entry) => entry.text)
				.filter((label) => label.includes("Root ")),
		).toHaveLength(8);
	});

	test("statistics browsing reaches a set through the same tree", async () => {
		await seedPublishedSetIn(harness, ["English"], "A1 words", [
			aQuestionInput("One"),
		]);

		await harness.send("/start");
		await harness.tap(buttonFor("Статистика"));
		await harness.tap(buttonFor("English"));
		await harness.tap(buttonFor("A1 words"));

		expect(harness.lastText()).toContain("Статистика");
		expect(harness.lastText()).toContain("A1 words");
	});

	test("statistics walks back to the folder it was opened from", async () => {
		await seedPublishedSetIn(harness, ["English"], "A1 words", [
			aQuestionInput("One"),
		]);

		await harness.send("/start");
		await harness.tap(buttonFor("Статистика"));
		await harness.tap(buttonFor("English"));
		await harness.tap(buttonFor("A1 words"));
		await harness.tap(buttonFor("До наборів"));

		expect(harness.lastText()).toContain("English");
		expect(buttonFor("A1 words")).toBeDefined();
	});

	test("an attempt walks back to the statistics of its own set", async () => {
		await seedPublishedSetIn(harness, ["English"], "A1 words", [
			aQuestionInput("One"),
		]);

		await harness.send("/start");
		await harness.tap(buttonFor("Статистика"));
		await harness.tap(buttonFor("English"));
		await harness.tap(buttonFor("A1 words"));
		await harness.tap(buttonFor("Меню"));
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("English"));
		await harness.tap(buttonFor("A1 words"));
		await harness.tap(buttonFor("One"));
		await harness.tap(buttonFor("Завершити"));
		await harness.tap(buttonFor("Статистика"));
		await harness.tap(buttonFor("деталі"));

		expect(harness.lastText()).toContain("A1 words");

		await harness.tap(buttonFor("До статистики"));

		expect(harness.lastText()).toContain("Статистика — A1 words");
		expect(buttonFor("деталі")).toBeDefined();
	});
});

describe("typed answers (§3.8)", () => {
	const seedTyped = async (): Promise<void> => {
		const { quizSetId } = await harness.application.createQuizSet.execute({
			title: "A1 words",
			language: "en",
		});

		await harness.application.addQuestions.execute({
			quizSetId,
			questions: [
				{
					type: QuestionType.TypedAnswer,
					prompt: "кіт",
					difficulty: "easy",
					options: [{ text: "cat", isCorrect: true }],
					explanation: "cat = кіт",
				},
			],
		});
		await harness.application.publishQuizSet.execute({ quizSetId });
	};

	const openTyped = async (): Promise<void> => {
		await seedTyped();
		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("A1 words"));
	};

	test("asks for a written answer instead of options", async () => {
		await openTyped();

		expect(harness.lastText()).toContain("кіт");
		expect(harness.lastText()).toContain("Напишіть відповідь");
		expect(harness.lastButtons().map((entry) => entry.text)).toContainEqual(
			expect.stringContaining("Не знаю"),
		);
	});

	test("accepts the right word typed as a message", async () => {
		await openTyped();

		await harness.send("cat");

		expect(harness.lastText()).toContain("Правильно");
	});

	test("ignores case and stray whitespace", async () => {
		await openTyped();

		await harness.send("  CAT  ");

		expect(harness.lastText()).toContain("Правильно");
	});

	test("rejects a wrong word and shows what was written", async () => {
		await openTyped();

		await harness.send("dog");

		expect(harness.lastText()).toContain("Неправильно");
		expect(harness.lastText()).toContain("Ви написали: dog");
		expect(harness.lastText()).toContain("cat");
	});

	test("names a near miss instead of leaving it a plain failure", async () => {
		await openTyped();

		await harness.send("cta");

		expect(harness.lastText()).toContain("Майже");
	});

	test("Не знаю reveals the answer and scores it wrong", async () => {
		await openTyped();

		await harness.tap(buttonFor("Не знаю"));

		expect(harness.lastText()).toContain("Неправильно");
		expect(harness.lastText()).toContain("cat");
	});

	test("a message with no attempt running still opens the menu", async () => {
		await harness.send("/start");

		await harness.send("cat");

		expect(harness.lastText()).toContain("Головне меню");
	});

	test("a cloze question is answered the same way", async () => {
		const { quizSetId } = await harness.application.createQuizSet.execute({
			title: "Prepositions",
			language: "en",
		});

		await harness.application.addQuestions.execute({
			quizSetId,
			questions: [
				{
					type: QuestionType.Cloze,
					prompt: "She has lived here ___ 2019.",
					difficulty: "medium",
					options: [{ text: "since", isCorrect: true }],
				},
			],
		});
		await harness.application.publishQuizSet.execute({ quizSetId });

		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("Prepositions"));

		expect(harness.lastText()).toContain("___");

		await harness.send("since");

		expect(harness.lastText()).toContain("Правильно");
	});
});

describe("typed answers do not consume unseen questions (§3.11)", () => {
	const seedThree = async (): Promise<void> => {
		const { quizSetId } = await harness.application.createQuizSet.execute({
			title: "Vocab",
			language: "en",
		});

		await harness.application.addQuestions.execute({
			quizSetId,
			questions: [
				{
					type: QuestionType.TypedAnswer,
					prompt: "кіт",
					difficulty: "easy",
					options: [{ text: "cat", isCorrect: true }],
				},
				{
					type: QuestionType.TypedAnswer,
					prompt: "пес",
					difficulty: "easy",
					options: [{ text: "dog", isCorrect: true }],
				},
			],
		});
		await harness.application.publishQuizSet.execute({ quizSetId });

		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("Vocab"));
	};

	test("the feedback screen already shows the next question", async () => {
		await seedThree();

		await harness.send("cat");

		expect(harness.lastText()).toContain("Правильно");
		expect(harness.lastText()).toContain("пес");
	});

	test("a following message answers the question that was shown", async () => {
		await seedThree();
		await harness.send("cat");

		await harness.send("dog");

		expect(harness.lastText()).toContain("Правильно");
		expect(harness.lastText()).toContain("2/2");
	});

	test("Не знаю also shows the next question", async () => {
		await seedThree();

		await harness.tap(buttonFor("Не знаю"));

		expect(harness.lastText()).toContain("cat");
		expect(harness.lastText()).toContain("пес");
	});

	test("a punctuation-only message opens the menu instead of erroring", async () => {
		await seedThree();

		await harness.send("?");

		expect(harness.lastText()).toContain("Головне меню");
	});
});
describe("ordering questions (§3.9)", () => {
	const seedOrdering = async (): Promise<void> => {
		const { quizSetId } = await harness.application.createQuizSet.execute({
			title: "Word order",
			language: "en",
		});

		await harness.application.addQuestions.execute({
			quizSetId,
			questions: [
				{
					type: QuestionType.Ordering,
					prompt: "Build the question",
					difficulty: "medium",
					options: [
						{ text: "where", isCorrect: true },
						{ text: "the station", isCorrect: true },
						{ text: "is", isCorrect: true },
					],
				},
			],
		});
		await harness.application.publishQuizSet.execute({ quizSetId });
	};

	const openOrdering = async (): Promise<void> => {
		await seedOrdering();
		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("Word order"));
	};

	test("offers every word and no answer button yet", async () => {
		await openOrdering();

		const labels = harness.lastButtons().map((entry) => entry.text);

		expect(labels).toContainEqual(expect.stringContaining("where"));
		expect(labels).toContainEqual(expect.stringContaining("the station"));
		expect(labels).toContainEqual(expect.stringContaining("is"));
		expect(labels).not.toContainEqual(expect.stringContaining("Відповісти"));
	});

	test("builds the sequence as words are tapped", async () => {
		await openOrdering();

		await harness.tap(buttonFor("where"));

		expect(harness.lastText()).toContain("1. where");
		expect(harness.lastButtons().map((entry) => entry.text)).not.toContainEqual(
			expect.stringContaining("where"),
		);
	});

	test("accepts the declared order", async () => {
		await openOrdering();

		await harness.tap(buttonFor("where"));
		await harness.tap(buttonFor("the station"));
		await harness.tap(buttonFor("is"));
		await harness.tap(buttonFor("Відповісти"));

		expect(harness.lastText()).toContain("Правильно");
	});

	test("rejects a different order", async () => {
		await openOrdering();

		await harness.tap(buttonFor("where"));
		await harness.tap(buttonFor("is"));
		await harness.tap(buttonFor("the station"));
		await harness.tap(buttonFor("Відповісти"));

		expect(harness.lastText()).toContain("Неправильно");
	});

	test("Скинути clears the sequence", async () => {
		await openOrdering();

		await harness.tap(buttonFor("where"));
		await harness.tap(buttonFor("Скинути"));

		const labels = harness.lastButtons().map((entry) => entry.text);

		expect(labels).toContainEqual(expect.stringContaining("where"));
		expect(harness.lastText()).toContain("Натискайте слова");
	});

	test("keeps the same shuffle when the screen is re-rendered", async () => {
		await openOrdering();

		const first = harness.lastButtons().map((entry) => entry.text);

		await harness.tap(buttonFor("where"));
		await harness.tap(buttonFor("Скинути"));

		expect(harness.lastButtons().map((entry) => entry.text)).toEqual(first);
	});
});

describe("matching questions (§3.10)", () => {
	const seedMatching = async (): Promise<void> => {
		const { quizSetId } = await harness.application.createQuizSet.execute({
			title: "Pairs",
			language: "en",
		});

		await harness.application.addQuestions.execute({
			quizSetId,
			questions: [
				{
					type: QuestionType.Matching,
					prompt: "Match the words",
					difficulty: "easy",
					options: [
						{ text: "cat", isCorrect: true, matchKey: "p0" },
						{ text: "dog", isCorrect: true, matchKey: "p1" },
						{ text: "кіт", isCorrect: true, matchKey: "p0" },
						{ text: "пес", isCorrect: true, matchKey: "p1" },
					],
				},
			],
		});
		await harness.application.publishQuizSet.execute({ quizSetId });
	};

	const openMatching = async (): Promise<void> => {
		await seedMatching();
		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("Pairs"));
	};

	test("offers the left column first", async () => {
		await openMatching();

		const labels = harness.lastButtons().map((entry) => entry.text);

		expect(labels).toContainEqual(expect.stringContaining("cat"));
		expect(labels).toContainEqual(expect.stringContaining("dog"));
		expect(labels).not.toContainEqual(expect.stringContaining("кіт"));
		expect(harness.lastText()).toContain("Оберіть слово ліворуч");
	});

	test("asks for a partner once a left word is chosen", async () => {
		await openMatching();

		await harness.tap(buttonFor("cat"));

		const labels = harness.lastButtons().map((entry) => entry.text);

		expect(harness.lastText()).toContain("Оберіть пару для «cat»");
		expect(labels).toContainEqual(expect.stringContaining("кіт"));
		expect(labels).not.toContainEqual(expect.stringContaining("dog"));
	});

	test("accepts every correct pair", async () => {
		await openMatching();

		await harness.tap(buttonFor("cat"));
		await harness.tap(buttonFor("кіт"));
		await harness.tap(buttonFor("dog"));
		await harness.tap(buttonFor("пес"));
		await harness.tap(buttonFor("Відповісти"));

		expect(harness.lastText()).toContain("Правильно");
	});

	test("rejects crossed pairs", async () => {
		await openMatching();

		await harness.tap(buttonFor("cat"));
		await harness.tap(buttonFor("пес"));
		await harness.tap(buttonFor("dog"));
		await harness.tap(buttonFor("кіт"));
		await harness.tap(buttonFor("Відповісти"));

		expect(harness.lastText()).toContain("Неправильно");
	});

	test("shows the pairs made so far", async () => {
		await openMatching();

		await harness.tap(buttonFor("cat"));
		await harness.tap(buttonFor("кіт"));

		expect(harness.lastText()).toContain("cat — кіт");
	});

	test("offers Відповісти only once every pair is made", async () => {
		await openMatching();

		await harness.tap(buttonFor("cat"));
		await harness.tap(buttonFor("кіт"));

		expect(harness.lastButtons().map((entry) => entry.text)).not.toContainEqual(
			expect.stringContaining("Відповісти"),
		);
	});

	test("Скинути clears every pair", async () => {
		await openMatching();

		await harness.tap(buttonFor("cat"));
		await harness.tap(buttonFor("кіт"));
		await harness.tap(buttonFor("Скинути"));

		expect(harness.lastText()).toContain("Оберіть слово ліворуч");
		expect(harness.lastButtons().map((entry) => entry.text)).toContainEqual(
			expect.stringContaining("cat"),
		);
	});
});

describe("matching feedback and limits (§3.12)", () => {
	test("a wrong answer shows the correct pairing, not a flat list", async () => {
		const { quizSetId } = await harness.application.createQuizSet.execute({
			title: "Pairs feedback",
			language: "en",
		});

		await harness.application.addQuestions.execute({
			quizSetId,
			questions: [
				{
					type: QuestionType.Matching,
					prompt: "Match",
					difficulty: "easy",
					options: [
						{ text: "cat", isCorrect: true, matchKey: "p0" },
						{ text: "dog", isCorrect: true, matchKey: "p1" },
						{ text: "кіт", isCorrect: true, matchKey: "p0" },
						{ text: "пес", isCorrect: true, matchKey: "p1" },
					],
				},
			],
		});
		await harness.application.publishQuizSet.execute({ quizSetId });

		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("Pairs feedback"));
		await harness.tap(buttonFor("cat"));
		await harness.tap(buttonFor("пес"));
		await harness.tap(buttonFor("dog"));
		await harness.tap(buttonFor("кіт"));
		await harness.tap(buttonFor("Відповісти"));

		expect(harness.lastText()).toContain("Неправильно");
		expect(harness.lastText()).toContain("cat — кіт");
		expect(harness.lastText()).toContain("dog — пес");
	});

	test("the prompt stops asking for a left word once everything is paired", async () => {
		const { quizSetId } = await harness.application.createQuizSet.execute({
			title: "All paired",
			language: "en",
		});

		await harness.application.addQuestions.execute({
			quizSetId,
			questions: [
				{
					type: QuestionType.Matching,
					prompt: "Match",
					difficulty: "easy",
					options: [
						{ text: "cat", isCorrect: true, matchKey: "p0" },
						{ text: "dog", isCorrect: true, matchKey: "p1" },
						{ text: "кіт", isCorrect: true, matchKey: "p0" },
						{ text: "пес", isCorrect: true, matchKey: "p1" },
					],
				},
			],
		});
		await harness.application.publishQuizSet.execute({ quizSetId });

		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("All paired"));
		await harness.tap(buttonFor("cat"));
		await harness.tap(buttonFor("кіт"));
		await harness.tap(buttonFor("dog"));
		await harness.tap(buttonFor("пес"));

		expect(harness.lastText()).not.toContain("Оберіть слово ліворуч");
		expect(harness.lastText()).toContain("Відповісти");
	});
});

describe("partial credit for matching (§3.13)", () => {
	const seedThreePairs = async (): Promise<void> => {
		const { quizSetId } = await harness.application.createQuizSet.execute({
			title: "Three pairs",
			language: "en",
		});

		await harness.application.addQuestions.execute({
			quizSetId,
			questions: [
				{
					type: QuestionType.Matching,
					prompt: "Match",
					difficulty: "easy",
					options: [
						{ text: "cat", isCorrect: true, matchKey: "p0" },
						{ text: "dog", isCorrect: true, matchKey: "p1" },
						{ text: "bird", isCorrect: true, matchKey: "p2" },
						{ text: "кіт", isCorrect: true, matchKey: "p0" },
						{ text: "пес", isCorrect: true, matchKey: "p1" },
						{ text: "птах", isCorrect: true, matchKey: "p2" },
					],
				},
			],
		});
		await harness.application.publishQuizSet.execute({ quizSetId });

		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("Three pairs"));
	};

	test("shows how many pairs are matched so far", async () => {
		await seedThreePairs();

		expect(harness.lastText()).toContain("Зіставлено 0/3");

		await harness.tap(buttonFor("cat"));
		await harness.tap(buttonFor("кіт"));

		expect(harness.lastText()).toContain("Зіставлено 1/3");
	});

	test("one right pair out of three earns a third of the question", async () => {
		await seedThreePairs();

		await harness.tap(buttonFor("cat"));
		await harness.tap(buttonFor("кіт"));
		await harness.tap(buttonFor("dog"));
		await harness.tap(buttonFor("птах"));
		await harness.tap(buttonFor("bird"));
		await harness.tap(buttonFor("пес"));
		await harness.tap(buttonFor("Відповісти"));

		expect(harness.lastText()).toContain("Неправильно");
		expect(harness.lastText()).toContain("Правильно 1 з 3 пар");
		expect(harness.lastText()).toContain("33.3%");
	});

	test("every pair right scores the whole question", async () => {
		await seedThreePairs();

		await harness.tap(buttonFor("cat"));
		await harness.tap(buttonFor("кіт"));
		await harness.tap(buttonFor("dog"));
		await harness.tap(buttonFor("пес"));
		await harness.tap(buttonFor("bird"));
		await harness.tap(buttonFor("птах"));
		await harness.tap(buttonFor("Відповісти"));

		expect(harness.lastText()).toContain("Правильно");
		expect(harness.lastText()).toContain("100%");
	});
});

describe("repetitions menu (§3.14)", () => {
	const day = 24 * 60 * 60 * 1000;

	const takeSet = async (title: string): Promise<void> => {
		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor(title));
		await harness.tap(buttonFor("Так"));
		await harness.tap(buttonFor("Завершити"));
	};

	const seedTwo = async (): Promise<void> => {
		for (const title of ["Alpha", "Beta"]) {
			const { quizSetId } = await harness.application.createQuizSet.execute({
				title,
				language: "uk",
			});

			await harness.application.addQuestions.execute({
				quizSetId,
				questions: [
					{
						type: QuestionType.TrueFalse,
						prompt: `${title}?`,
						difficulty: "easy",
						options: [
							{ text: "Так", isCorrect: true },
							{ text: "Ні", isCorrect: false },
						],
					},
				],
			});
			await harness.application.publishQuizSet.execute({ quizSetId });
		}
	};

	test("says so when nothing is due", async () => {
		await harness.send("/start");
		await harness.tap(buttonFor("Повторення"));

		expect(harness.lastText()).toContain("Нічого повторювати");
	});

	test("lists a set once its day arrives", async () => {
		await seedTwo();
		await takeSet("Alpha");

		await harness.send("/start");
		await harness.tap(buttonFor("Повторення"));

		expect(harness.lastText()).toContain("Нічого повторювати");

		harness.clock.advance(day);
		await harness.send("/start");
		await harness.tap(buttonFor("Повторення"));

		expect(harness.lastText()).toContain("Alpha");
		expect(harness.lastText()).toContain("сьогодні");
	});

	test("puts the most overdue set first", async () => {
		await seedTwo();
		await takeSet("Alpha");
		harness.clock.advance(10 * day);
		await takeSet("Beta");
		harness.clock.advance(2 * day);

		await harness.send("/start");
		await harness.tap(buttonFor("Повторення"));

		const lines = harness
			.lastText()
			.split("\n")
			.filter((l) => l.startsWith("•"));

		expect(lines[0]).toContain("Alpha");
		expect(lines[1]).toContain("Beta");
	});

	test("starts the set the user picks", async () => {
		await seedTwo();
		await takeSet("Alpha");
		harness.clock.advance(day);

		await harness.send("/start");
		await harness.tap(buttonFor("Повторення"));
		await harness.tap(buttonFor("Alpha"));

		expect(harness.lastText()).toContain("Alpha?");
	});
});

describe("attempt details (§3.15)", () => {
	const seedAndTake = async (): Promise<void> => {
		const { quizSetId } = await harness.application.createQuizSet.execute({
			title: "Details",
			language: "uk",
		});

		await harness.application.addQuestions.execute({
			quizSetId,
			questions: [
				{
					type: QuestionType.TrueFalse,
					prompt: "Небо синє?",
					difficulty: "easy",
					options: [
						{ text: "Так", isCorrect: true },
						{ text: "Ні", isCorrect: false },
					],
				},
				{
					type: QuestionType.TypedAnswer,
					prompt: "кіт",
					difficulty: "easy",
					options: [{ text: "cat", isCorrect: true }],
				},
			],
		});
		await harness.application.publishQuizSet.execute({ quizSetId });

		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("Details"));
		await harness.tap(buttonFor("Ні"));
		await harness.send("cat");
		await harness.tap(buttonFor("Завершити"));
	};

	test("statistics lists each attempt as a button", async () => {
		await seedAndTake();

		await harness.send("/start");
		await harness.tap(buttonFor("Статистика"));
		await harness.tap(buttonFor("Details"));

		expect(harness.lastButtons().map((entry) => entry.text)).toContainEqual(
			expect.stringContaining("деталі"),
		);
	});

	test("the detail screen shows every question and what was answered", async () => {
		await seedAndTake();

		await harness.send("/start");
		await harness.tap(buttonFor("Статистика"));
		await harness.tap(buttonFor("Details"));
		await harness.tap(buttonFor("деталі"));

		const text = harness.lastText();

		expect(text).toContain("Небо синє?");
		expect(text).toContain("кіт");
		expect(text).toContain("Ні");
		expect(text).toContain("cat");
		expect(text).toContain("❌");
		expect(text).toContain("✅");
	});

	test("shows the correct answer for what was got wrong", async () => {
		await seedAndTake();

		await harness.send("/start");
		await harness.tap(buttonFor("Статистика"));
		await harness.tap(buttonFor("Details"));
		await harness.tap(buttonFor("деталі"));

		expect(harness.lastText()).toContain("✔️");
	});
});

describe("attempt details stay inside Telegram's limit (§3.16)", () => {
	test("a long attempt is trimmed with a footer, not silently cut", async () => {
		const { quizSetId } = await harness.application.createQuizSet.execute({
			title: "Long",
			language: "uk",
		});

		await harness.application.addQuestions.execute({
			quizSetId,
			questions: Array.from({ length: 30 }, (_value, index) => ({
				type: QuestionType.TrueFalse,
				prompt: `Питання ${index} — ${"д".repeat(120)}`,
				difficulty: "easy" as const,
				options: [
					{ text: "Так", isCorrect: true },
					{ text: "Ні", isCorrect: false },
				],
			})),
		});
		await harness.application.publishQuizSet.execute({ quizSetId });

		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("Long"));

		for (let index = 0; index < 30; index += 1) {
			await harness.tap(buttonFor("Так"));

			if (index < 29) {
				await harness.tap(buttonFor("Далі"));
			}
		}

		await harness.tap(buttonFor("Завершити"));
		await harness.send("/start");
		await harness.tap(buttonFor("Статистика"));
		await harness.tap(buttonFor("Long"));
		await harness.tap(buttonFor("деталі"));

		const text = harness.lastText();

		expect(text.length).toBeLessThanOrEqual(4096);
		expect(text).toContain("і ще");
		expect(text).not.toContain("(скорочено)");
	});
});

describe("a repetition drills only what is due (§3.17)", () => {
	const day = 24 * 60 * 60 * 1000;

	const seedThree = async (): Promise<string> => {
		const { quizSetId } = await harness.application.createQuizSet.execute({
			title: "Words",
			language: "uk",
		});

		await harness.application.addQuestions.execute({
			quizSetId,
			questions: ["Перше", "Друге", "Третє"].map((prompt) => ({
				type: QuestionType.TrueFalse,
				prompt: `${prompt}?`,
				difficulty: "easy" as const,
				options: [
					{ text: "Так", isCorrect: true },
					{ text: "Ні", isCorrect: false },
				],
			})),
		});
		await harness.application.publishQuizSet.execute({ quizSetId });

		return String(quizSetId);
	};

	test("the menu counts the words due, not the sets", async () => {
		await seedThree();
		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("Words"));
		await harness.tap(buttonFor("Так"));
		await harness.tap(buttonFor("Далі"));
		await harness.tap(buttonFor("Ні"));
		await harness.tap(buttonFor("Далі"));
		await harness.tap(buttonFor("Так"));
		await harness.tap(buttonFor("Завершити"));

		harness.clock.advance(day);
		await harness.send("/start");
		await harness.tap(buttonFor("Повторення"));

		expect(harness.lastText()).toContain("Words");
		expect(harness.lastText()).toContain("сл.");
	});

	const answerAll = async (verdicts: readonly boolean[]): Promise<void> => {
		for (const [index, correct] of verdicts.entries()) {
			await harness.tap(buttonFor(correct ? "Так" : "Ні"));

			if (index < verdicts.length - 1) {
				await harness.tap(buttonFor("Далі"));
			}
		}

		await harness.tap(buttonFor("Завершити"));
	};

	test("a forgotten word comes back sooner than a remembered one", async () => {
		await seedThree();
		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("Words"));
		await answerAll([true, true, true]);

		harness.clock.advance(day);
		await harness.send("/start");
		await harness.tap(buttonFor("Повторення"));
		await harness.tap(buttonFor("Words"));

		expect(harness.lastText()).toContain("питання 1/3");

		await answerAll([true, false, true]);

		harness.clock.advance(day);
		await harness.send("/start");
		await harness.tap(buttonFor("Повторення"));
		await harness.tap(buttonFor("Words"));

		expect(harness.lastText()).toContain("питання 1/1");
		expect(harness.lastText()).toContain("Друге?");
	});
});

describe("words that keep being forgotten (§3.18)", () => {
	const day = 24 * 60 * 60 * 1000;

	test("are surfaced once they pass the threshold", async () => {
		const { quizSetId } = await harness.application.createQuizSet.execute({
			title: "Hard",
			language: "uk",
		});

		await harness.application.addQuestions.execute({
			quizSetId,
			questions: [
				{
					type: QuestionType.TrueFalse,
					prompt: "Уперте питання?",
					difficulty: "easy",
					options: [
						{ text: "Так", isCorrect: true },
						{ text: "Ні", isCorrect: false },
					],
				},
			],
		});
		await harness.application.publishQuizSet.execute({ quizSetId });

		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("Hard"));

		for (let round = 0; round < 5; round += 1) {
			await harness.tap(buttonFor("Ні"));
			await harness.tap(buttonFor("Завершити"));

			harness.clock.advance(day);
			await harness.send("/start");
			await harness.tap(buttonFor("Повторення"));

			if (round < 4) {
				await harness.tap(buttonFor("Hard"));
			}
		}

		expect(harness.lastText()).toContain("Не даються");
		expect(harness.lastText()).toContain("Уперте питання?");
		expect(harness.lastText()).toContain("забуто 5 р.");
	});
});

describe("shuffled answer options (§3.9)", () => {
	const fourOptions = (prompt: string) =>
		aQuestionInput(prompt, {
			options: [
				{ text: "Alpha", isCorrect: true },
				{ text: "Bravo", isCorrect: false },
				{ text: "Charlie", isCorrect: false },
				{ text: "Delta", isCorrect: false },
			],
		});

	const optionLabels = (): string[] =>
		harness
			.lastButtons()
			.map((entry) => entry.text)
			.filter((text) => !text.includes("Меню"));

	const enableShuffle = async (): Promise<void> => {
		const sets = await harness.application.listQuizSets.execute({
			includeUnpublished: true,
		});
		const quizSetId = sets[0]?.id;

		if (quizSetId === undefined) throw new Error("no set was seeded");

		await harness.application.updateQuizSettings.execute({
			quizSetId,
			shuffleOptions: true,
		});
	};

	test("keeps the authored order while the toggle is off", async () => {
		await seedPublishedSet(harness, "Bun", [fourOptions("One")]);
		await openSet("Bun");

		expect(optionLabels()).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
	});

	test("shows a different order once the toggle is on", async () => {
		await seedPublishedSet(harness, "Bun", [fourOptions("One")]);
		await enableShuffle();
		await openSet("Bun");

		expect(optionLabels()).not.toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
		expect(optionLabels().toSorted()).toEqual([
			"Alpha",
			"Bravo",
			"Charlie",
			"Delta",
		]);
	});

	test("a whole set answered by name still scores full marks", async () => {
		await seedPublishedSet(harness, "Bun", [
			fourOptions("One"),
			fourOptions("Two"),
			fourOptions("Three"),
			fourOptions("Four"),
		]);
		await enableShuffle();
		await openSet("Bun");

		for (let answered = 0; answered < 4; answered += 1) {
			await harness.tap(buttonFor("Alpha"));

			if (answered < 3) {
				await harness.tap(buttonFor("Далі"));
			}
		}

		await harness.tap(buttonFor("Завершити"));

		expect(harness.lastText()).toContain("4/4");
	});

	test("a wrong option stays wrong after the shuffle", async () => {
		await seedPublishedSet(harness, "Bun", [fourOptions("One")]);
		await enableShuffle();
		await openSet("Bun");

		await harness.tap(buttonFor("Charlie"));

		expect(harness.lastText()).not.toContain("Правильно");
	});

	test("does not reshuffle under the finger while a question is open", async () => {
		await seedPublishedSet(harness, "Bun", [
			fourOptions("One"),
			fourOptions("Two"),
		]);
		await enableShuffle();
		await openSet("Bun");

		const first = optionLabels();

		await harness.send("/start");
		await harness.tap(buttonFor("Продовжити навчання"));

		expect(optionLabels()).toEqual(first);
	});
});

describe("shuffled question order (§3.9)", () => {
	const PROMPTS = ["One", "Two", "Three", "Four", "Five", "Six", "Seven"];

	const seedSeven = (): Promise<QuizSetId> =>
		seedPublishedSet(
			harness,
			"Bun",
			PROMPTS.map((prompt) => aQuestionInput(prompt)),
		);

	const enableQuestionShuffle = async (quizSetId: QuizSetId): Promise<void> => {
		await harness.application.updateQuizSettings.execute({
			quizSetId,
			shuffleQuestions: true,
		});
	};

	const promptOnScreen = (): string => {
		const shown = PROMPTS.find((prompt) => harness.lastText().includes(prompt));

		if (shown === undefined) {
			throw new Error(`no question on screen: ${harness.lastText()}`);
		}

		return shown;
	};

	const answerEveryQuestion = async (): Promise<readonly string[]> => {
		const seen: string[] = [];

		for (let answered = 0; answered < PROMPTS.length; answered += 1) {
			seen.push(promptOnScreen());
			await harness.tap(buttonFor("Right for"));

			if (answered < PROMPTS.length - 1) {
				await harness.tap(buttonFor("Далі"));
			}
		}

		return seen;
	};

	test("asks in the authored order while the toggle is off", async () => {
		await seedSeven();
		await openSet("Bun");

		expect(await answerEveryQuestion()).toEqual(PROMPTS);
	});

	test("asks in a different order once the toggle is on", async () => {
		const quizSetId = await seedSeven();
		await enableQuestionShuffle(quizSetId);
		await openSet("Bun");

		const asked = await answerEveryQuestion();

		expect(asked).not.toEqual(PROMPTS);
		expect([...asked].toSorted()).toEqual([...PROMPTS].toSorted());
	});

	test("still scores every question of a shuffled run", async () => {
		const quizSetId = await seedSeven();
		await enableQuestionShuffle(quizSetId);
		await openSet("Bun");
		await answerEveryQuestion();

		await harness.tap(buttonFor("Завершити"));

		expect(harness.lastText()).toContain("7/7");
	});

	test("the order survives leaving and resuming the attempt", async () => {
		const quizSetId = await seedSeven();
		await enableQuestionShuffle(quizSetId);
		await openSet("Bun");

		const opened = promptOnScreen();

		await harness.send("/start");
		await harness.tap(buttonFor("Продовжити навчання"));

		expect(promptOnScreen()).toBe(opened);
	});
});

describe("exam mode (§3.12)", () => {
	const enableExam = async (): Promise<void> => {
		const sets = await harness.application.listQuizSets.execute({
			includeUnpublished: true,
		});
		const quizSetId = sets[0]?.id;

		if (quizSetId === undefined) throw new Error("no set was seeded");

		await harness.application.updateQuizSettings.execute({
			quizSetId,
			examMode: true,
		});
	};

	const seedTwo = () =>
		seedPublishedSet(harness, "Bun", [
			aQuestionInput("One", { explanation: "Because One" }),
			aQuestionInput("Two", { explanation: "Because Two" }),
		]);

	test("a wrong answer says nothing about being wrong", async () => {
		await seedTwo();
		await enableExam();
		await openSet("Bun");

		await harness.tap(buttonFor("Wrong for One"));

		expect(harness.lastText()).not.toContain("Неправильно");
		expect(harness.lastText()).not.toContain("Правильна відповідь");
		expect(harness.lastText()).not.toContain("Because One");
	});

	test("the running score stays hidden", async () => {
		await seedTwo();
		await enableExam();
		await openSet("Bun");

		await harness.tap(buttonFor("Right for One"));

		expect(harness.lastText()).not.toContain("Рахунок");
	});

	test("the next question comes straight up, with no Далі step", async () => {
		await seedTwo();
		await enableExam();
		await openSet("Bun");

		await harness.tap(buttonFor("Right for One"));

		expect(harness.lastText()).toContain("Two");
		expect(harness.lastButtons().map((entry) => entry.text)).not.toContainEqual(
			expect.stringContaining("Далі"),
		);
	});

	test("the last answer offers finishing instead of a verdict", async () => {
		await seedTwo();
		await enableExam();
		await openSet("Bun");
		await harness.tap(buttonFor("Right for One"));

		await harness.tap(buttonFor("Right for Two"));

		expect(harness.lastText()).not.toContain("Правильно");
		expect(harness.lastButtons().map((entry) => entry.text)).toContainEqual(
			expect.stringContaining("Завершити"),
		);
	});

	test("the review after finishing does show the answers", async () => {
		await seedTwo();
		await enableExam();
		await openSet("Bun");
		await harness.tap(buttonFor("Wrong for One"));
		await harness.tap(buttonFor("Right for Two"));
		await harness.tap(buttonFor("Завершити"));

		expect(harness.lastText()).toContain("1/2");

		await harness.tap(buttonFor("Розбір"));

		expect(harness.lastText()).toContain("One");
		expect(harness.lastText()).toContain("Two");
	});

	test("the review explains what you got wrong", async () => {
		await seedTwo();
		await enableExam();
		await openSet("Bun");
		await harness.tap(buttonFor("Wrong for One"));
		await harness.tap(buttonFor("Right for Two"));
		await harness.tap(buttonFor("Завершити"));

		await harness.tap(buttonFor("Розбір"));

		expect(harness.lastText()).toContain("Because One");
		expect(harness.lastText()).not.toContain("Because Two");
	});

	test("feedback still works when the mode is off", async () => {
		await seedTwo();
		await openSet("Bun");

		await harness.tap(buttonFor("Wrong for One"));

		expect(harness.lastText()).toContain("Неправильно");
		expect(harness.lastText()).toContain("Because One");
		expect(harness.lastText()).toContain("Рахунок");
	});
});

describe("mistakes and weak topics (§3.11)", () => {
	const topical = (prompt: string, topic?: string) =>
		aQuestionInput(prompt, { topic });

	const playWrong = async (title: string, wrong: number): Promise<void> => {
		await openSet(title);

		for (let answered = 0; answered < wrong; answered += 1) {
			await harness.tap(buttonFor("Wrong for"));

			if (answered < wrong - 1) {
				await harness.tap(buttonFor("Далі"));
			}
		}

		await harness.send("/start");
		await harness.tap(buttonFor("Завершити спробу"));
	};

	const openDrill = async (entry: string, title: string): Promise<void> => {
		await harness.send("/start");
		await harness.tap(buttonFor(entry));
		await harness.tap(buttonFor(title));
	};

	test("the menu offers both drills", async () => {
		await harness.send("/start");

		const labels = harness.lastButtons().map((entry) => entry.text);

		expect(labels).toContainEqual(expect.stringContaining("Повторити помилки"));
		expect(labels).toContainEqual(expect.stringContaining("Слабкі теми"));
	});

	test("a mistakes drill asks only what is still wrong", async () => {
		await seedPublishedSet(harness, "Bun", [
			topical("One"),
			topical("Two"),
			topical("Three"),
		]);
		await playWrong("Bun", 2);

		await openDrill("Повторити помилки", "Bun");

		expect(harness.lastText()).toContain("питання 1/2");
	});

	test("says so when nothing is outstanding", async () => {
		await seedPublishedSet(harness, "Bun", [topical("One")]);
		await openSet("Bun");
		await harness.tap(buttonFor("Right for"));
		await harness.tap(buttonFor("Завершити"));

		await openDrill("Повторити помилки", "Bun");

		expect(harness.lastText()).toContain("Помилок немає");
	});

	test("a weak-topic drill asks the weak topic only", async () => {
		await seedPublishedSet(harness, "Bun", [
			topical("W1", "Weak"),
			topical("W2", "Weak"),
			topical("W3", "Weak"),
			topical("S1", "Strong"),
		]);
		await playWrong("Bun", 3);

		await openDrill("Слабкі теми", "Bun");

		expect(harness.lastText()).toContain("питання 1/3");
	});

	test("says so when no topic is weak yet", async () => {
		await seedPublishedSet(harness, "Bun", [topical("One", "Alpha")]);
		await openSet("Bun");
		await harness.tap(buttonFor("Right for"));
		await harness.tap(buttonFor("Завершити"));

		await openDrill("Слабкі теми", "Bun");

		expect(harness.lastText()).toContain("Слабких тем");
	});

	test("the empty state walks back to the folder the set lives in", async () => {
		await seedPublishedSetIn(harness, ["Мова"], "Filed", [
			topical("One", "Alpha"),
		]);

		await harness.send("/start");
		await harness.tap(buttonFor("Слабкі теми"));
		await harness.tap(buttonFor("Мова"));
		await harness.tap(buttonFor("Filed"));

		expect(harness.lastText()).toContain("Слабких тем");

		await harness.tap(buttonFor("До наборів"));

		expect(harness.lastText()).toContain("Мова");
	});

	test("a drill can be played to a score", async () => {
		await seedPublishedSet(harness, "Bun", [topical("One"), topical("Two")]);
		await playWrong("Bun", 2);

		await openDrill("Повторити помилки", "Bun");
		await harness.tap(buttonFor("Right for"));
		await harness.tap(buttonFor("Далі"));
		await harness.tap(buttonFor("Right for"));
		await harness.tap(buttonFor("Завершити"));

		expect(harness.lastText()).toContain("2/2");
	});
});

describe("settings (§3.10)", () => {
	const openGlobal = async (): Promise<void> => {
		await harness.send("/start");
		await harness.tap(buttonFor("Налаштування"));
		await harness.tap(buttonFor("Загальні"));
	};

	const openForSet = async (title: string): Promise<void> => {
		await harness.send("/start");
		await harness.tap(buttonFor("Налаштування"));
		await harness.tap(buttonFor("Для набору"));
		await harness.tap(buttonFor(title));
	};

	test("the global screen starts on the built-in settings", async () => {
		await openGlobal();

		expect(harness.lastText()).toContain("Джерело: вбудовані");
		expect(harness.lastText()).toContain("1 → 3 → 7 → 14 → 30");
		expect(harness.lastText()).toContain("Перемішувати варіанти: ні");
		expect(harness.lastText()).toContain("Перемішувати питання: ні");
		expect(harness.lastText()).toContain("Режим екзамену: ні");
	});

	test("a preset replaces the ladder and marks itself", async () => {
		await openGlobal();

		await harness.tap(buttonFor("Повільно"));

		expect(harness.lastText()).toContain("1 → 3 → 7 → 21 → 60");
		expect(harness.lastText()).toContain("Джерело: глобальні");
		expect(
			harness.lastButtons().find((entry) => entry.text.includes("Повільно"))
				?.text,
		).toContain("✓");
	});

	test("a preset lifts a ceiling that would have clipped it", async () => {
		await openGlobal();

		await harness.tap(buttonFor("Повільно"));

		expect(harness.lastText()).toContain("Стеля: 60 дн.");
		expect(harness.lastText()).not.toContain("обрізана");
	});

	test("the ceiling steps one rung at a time and stops at the top", async () => {
		await openGlobal();

		await harness.tap(buttonFor("Стеля"));

		expect(harness.lastText()).toContain("Стеля: 30 дн.");

		const up = harness
			.lastButtons()
			.find((entry) => entry.text === "+")?.callback_data;

		if (up === undefined) throw new Error("no step-up button");

		for (let step = 0; step < 10; step += 1) {
			await harness.tap(up);
		}

		expect(harness.lastText()).toContain("Стеля: 365 дн.");
	});

	test("the repetition limit steps down and stops at one", async () => {
		await openGlobal();

		const down = harness
			.lastButtons()
			.filter((entry) => entry.text === "−")
			.at(-1)?.callback_data;

		if (down === undefined) throw new Error("no step-down button");

		for (let step = 0; step < 12; step += 1) {
			await harness.tap(down);
		}

		expect(harness.lastText()).toContain("Максимум повторень: 1");
	});

	test("the shuffle toggle flips and stays flipped", async () => {
		await openGlobal();

		await harness.tap(buttonFor("Перемішувати варіанти"));

		expect(harness.lastText()).toContain("Перемішувати варіанти: так");

		await harness.send("/start");
		await harness.tap(buttonFor("Налаштування"));
		await harness.tap(buttonFor("Загальні"));

		expect(harness.lastText()).toContain("Перемішувати варіанти: так");
	});

	test("the question shuffle toggle flips and stays flipped", async () => {
		await openGlobal();

		await harness.tap(buttonFor("Перемішувати питання"));

		expect(harness.lastText()).toContain("Перемішувати питання: так");

		await harness.send("/start");
		await harness.tap(buttonFor("Налаштування"));
		await harness.tap(buttonFor("Загальні"));

		expect(harness.lastText()).toContain("Перемішувати питання: так");
	});

	test("the exam toggle flips and stays flipped", async () => {
		await openGlobal();

		await harness.tap(buttonFor("Режим екзамену"));

		expect(harness.lastText()).toContain("Режим екзамену: так");

		await harness.send("/start");
		await harness.tap(buttonFor("Налаштування"));
		await harness.tap(buttonFor("Загальні"));

		expect(harness.lastText()).toContain("Режим екзамену: так");
	});

	test("the exam toggle leaves the shuffles alone", async () => {
		await openGlobal();

		await harness.tap(buttonFor("Режим екзамену"));

		expect(harness.lastText()).toContain("Перемішувати варіанти: ні");
		expect(harness.lastText()).toContain("Перемішувати питання: ні");
	});

	test("the two shuffle toggles move independently", async () => {
		await openGlobal();

		await harness.tap(buttonFor("Перемішувати питання"));

		expect(harness.lastText()).toContain("Перемішувати питання: так");
		expect(harness.lastText()).toContain("Перемішувати варіанти: ні");
	});

	test("a set follows the global settings until it is touched", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await openGlobal();
		await harness.tap(buttonFor("Швидко"));
		await openForSet("Bun");

		expect(harness.lastText()).toContain("Джерело: глобальні");
		expect(harness.lastText()).toContain("1 → 2 → 4 → 7 → 14");
	});

	test("touching a set pins it, and the reset lets it follow again", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await openForSet("Bun");

		await harness.tap(buttonFor("Повільно"));

		expect(harness.lastText()).toContain("Джерело: власні");

		await harness.tap(buttonFor("Скинути до глобальних"));

		expect(harness.lastText()).toContain("Джерело: вбудовані");
		expect(harness.lastText()).toContain("1 → 3 → 7 → 14 → 30");
	});

	test("a set's settings do not leak into the global ones", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput("One")]);
		await openForSet("Bun");
		await harness.tap(buttonFor("Перемішувати"));

		expect(harness.lastText()).toContain("Перемішувати варіанти: так");

		await openGlobal();

		expect(harness.lastText()).toContain("Перемішувати варіанти: ні");
	});

	test("the label between the steppers changes nothing", async () => {
		await openGlobal();
		const before = harness.lastText();

		await harness.tap(buttonFor("Стеля:"));

		expect(harness.lastText()).toBe(before);
	});

	test("a set walks back to the folder it was opened from", async () => {
		await seedPublishedSetIn(harness, ["English"], "A1 words", [
			aQuestionInput("One"),
		]);
		await harness.send("/start");
		await harness.tap(buttonFor("Налаштування"));
		await harness.tap(buttonFor("Для набору"));
		await harness.tap(buttonFor("English"));
		await harness.tap(buttonFor("A1 words"));
		await harness.tap(buttonFor("До наборів"));

		expect(harness.lastText()).toContain("English");
		expect(buttonFor("A1 words")).toBeDefined();
	});
});
