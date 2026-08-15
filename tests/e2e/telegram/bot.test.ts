import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { QuestionType } from "@/domain/quiz-set/question";
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
