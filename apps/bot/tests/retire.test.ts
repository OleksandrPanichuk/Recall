import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { QuestionId, QuizSetId } from "@api/modules/quizzes";
import { DEFAULT_LEECH_THRESHOLD } from "@api/modules/scheduling";
import {
	aQuestionInput,
	type BotHarness,
	createBotHarness,
	seedPublishedSet,
} from "./bot-harness";

let harness: BotHarness;

beforeEach(async () => {
	harness = await createBotHarness();
});

afterEach(async () => {
	await harness.close();
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

const questionIdFor = async (
	quizSetId: QuizSetId,
	prompt: string,
): Promise<QuestionId> => {
	const question = (
		await harness.application.context.scope.quizzes.findById(quizSetId)
	)?.questions.find((candidate) => candidate.prompt === prompt);

	if (question === undefined) {
		throw new Error(`the set holds no question prompted "${prompt}"`);
	}

	return question.id;
};

const stickAt = async (questionId: QuestionId, lapses: number) => {
	await harness.application.context.scope.reviews.saveSchedules([
		{
			questionId,
			repetitionCount: 1,
			lapses,
			lastCompletedAt: harness.clock.now(),
			dueAt: harness.clock.now(),
		},
	]);
};

const openStuck = async () => {
	await harness.send("/start");
	await harness.tap(buttonFor("Повторення"));
	await harness.tap(buttonFor("Не даються"));
};

describe("retiring a question that will not stick", () => {
	let quizSetId: QuizSetId;

	beforeEach(async () => {
		quizSetId = await seedPublishedSet(harness, "Bun", [
			aQuestionInput("One"),
			aQuestionInput("Two"),
		]);
		await stickAt(
			await questionIdFor(quizSetId, "One"),
			DEFAULT_LEECH_THRESHOLD,
		);
	});

	test("the stuck list offers the question by its prompt", async () => {
		await openStuck();

		expect(harness.lastText()).toContain("One");
		expect(harness.lastButtons().map((entry) => entry.text)).toContain("🗄 One");
	});

	test("retiring it takes it off the stuck list", async () => {
		await openStuck();
		await harness.tap(buttonFor("🗄 One"));

		expect(harness.lastText()).toContain("Нічого не застрягло");
	});

	test("a retired question is listed as retired and can come back", async () => {
		await openStuck();
		await harness.tap(buttonFor("🗄 One"));
		await harness.tap(buttonFor("Відкладені"));

		expect(harness.lastText()).toContain("Відкладені: 1");
		expect(harness.lastText()).toContain("One");

		await harness.tap(buttonFor("↩️ One"));

		expect(harness.lastText()).toContain("Нічого не відкладено");
	});

	test("bringing it back makes it due again", async () => {
		await openStuck();
		await harness.tap(buttonFor("🗄 One"));
		await harness.tap(buttonFor("Відкладені"));
		await harness.tap(buttonFor("↩️ One"));

		const due = await harness.application.context.scope.reviews.listDue(
			harness.clock.now(),
		);

		expect(due.map((schedule) => String(schedule.questionId))).toEqual([
			String(await questionIdFor(quizSetId, "One")),
		]);
	});

	test("the retired list is reachable even with nothing stuck", async () => {
		await stickAt(await questionIdFor(quizSetId, "One"), 0);
		await harness.send("/start");
		await harness.tap(buttonFor("Повторення"));

		expect(harness.lastButtons().map((entry) => entry.text)).toContain(
			"🗄 Відкладені",
		);
	});
});
