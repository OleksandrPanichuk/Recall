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

	test.each([
		["Повторити помилки", "Phase 5"],
		["Слабкі теми", "Phase 5"],
		["Налаштування", "Phase 6"],
	])("%s routes to a placeholder", async (label, phase) => {
		await harness.send("/start");

		await harness.tap(buttonFor(label));

		expect(harness.lastText()).toContain(phase);
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
			expect(option.callback_data).toMatch(/^a:q-\d+:\d+$/);
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
