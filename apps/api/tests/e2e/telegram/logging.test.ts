import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	createRecordingLogger,
	type RecordingLogger,
} from "@tests/fixtures/logger.fixture";
import {
	aQuestionInput,
	type BotHarness,
	createBotHarness,
	OTHER_USER,
	seedPublishedSet,
} from "./bot-harness";

let harness: BotHarness;
let logger: RecordingLogger;

const PROMPT = "Which Bun API replaces better-sqlite3?";

beforeEach(() => {
	logger = createRecordingLogger();
	harness = createBotHarness({ logger });
});

afterEach(() => {
	harness.close();
});

const buttonFor = (label: string): string => {
	const found = harness
		.lastButtons()
		.find((entry) => entry.text.includes(label));

	if (found === undefined) {
		throw new Error(`no button matching "${label}"`);
	}

	return found.callback_data;
};

const answerButton = (): string => {
	const found = harness
		.lastButtons()
		.find((entry) => entry.callback_data.startsWith("a:"));

	if (found === undefined) {
		throw new Error("no answer button on the current screen");
	}

	return found.callback_data;
};

describe("telegram request logging (§6.2)", () => {
	test("logs the opening command", async () => {
		await harness.send("/start");

		expect(logger.of("telegram update").at(-1)).toMatchObject({
			update: "message",
			command: "/start",
			outcome: "ok",
		});
	});

	test("logs one record for every button the user presses", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput(PROMPT)]);
		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("Bun"));

		expect(logger.of("telegram update").map((record) => record.action)).toEqual(
			[undefined, "sets", "start-set"],
		);
	});

	test("names the set an attempt started from", async () => {
		const quizSetId = await seedPublishedSet(harness, "Bun", [
			aQuestionInput(PROMPT),
		]);

		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("Bun"));

		expect(logger.of("telegram update").at(-1)).toMatchObject({
			action: "start-set",
			quizSetId,
			telegramUserId: 42,
		});
	});

	test("keeps question and option text out of the log", async () => {
		await seedPublishedSet(harness, "Bun", [aQuestionInput(PROMPT)]);
		await harness.send("/start");
		await harness.tap(buttonFor("Мої набори"));
		await harness.tap(buttonFor("Bun"));
		await harness.tap(answerButton());

		expect(logger.text()).not.toContain("Bun API");
		expect(logger.text()).not.toContain("Right for");
	});

	test("warns about an update from a user who is not allowed", async () => {
		await harness.send("/start", OTHER_USER);

		expect(logger.of("rejected an update from an unknown user")).toMatchObject([
			{ level: "warn", telegramUserId: OTHER_USER },
		]);
	});

	test("reports a handler failure with the action that caused it", async () => {
		await harness.send("/start");
		harness.failNext({ method: "editMessageText", message: "429: too many" });
		await harness.tap(buttonFor("Мої набори"));

		expect(logger.of("telegram handler failed").at(0)).toMatchObject({
			action: "sets",
			error: { name: "Error" },
		});
		expect(logger.of("telegram update").at(-1)).toMatchObject({
			outcome: "failed",
		});
	});
});
