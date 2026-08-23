import { describe, expect, test } from "bun:test";
import type { Context } from "telegraf";
import { describeUpdate, updateTypeOf } from "./describe-update";

const contextOf = (update: Record<string, unknown>): Context =>
	({ from: { id: 42 }, ...update }) as unknown as Context;

const callbackContext = (data: string): Context =>
	contextOf({ callbackQuery: { data }, updateType: "callback_query" });

const messageContext = (text: string): Context =>
	contextOf({ message: { text }, updateType: "message" });

describe("describeUpdate", () => {
	test("names the pressed action and the set behind it", () => {
		expect(describeUpdate(callbackContext("s:set-1"))).toEqual({
			telegramUserId: 42,
			update: "callback_query",
			action: "start-set",
			quizSetId: "set-1",
		});
	});

	test("counts the selected options without naming them", () => {
		expect(describeUpdate(callbackContext("a:q-7:0,2"))).toEqual({
			telegramUserId: 42,
			update: "callback_query",
			action: "answer",
			questionId: "q-7",
			optionCount: 2,
		});
	});

	test("marks callback data it could not decode", () => {
		expect(describeUpdate(callbackContext("nonsense"))).toMatchObject({
			action: "undecodable",
		});
	});

	test("keeps the command but never the message body", () => {
		expect(describeUpdate(messageContext("/start"))).toEqual({
			telegramUserId: 42,
			update: "message",
			command: "/start",
			textLength: 6,
		});
	});

	test("keeps a command whose body follows on the next line out of the log", () => {
		const fields = describeUpdate(
			messageContext("/start\nмій приватний конспект"),
		);

		expect(fields.command).toBe("/start");
		expect(JSON.stringify(fields)).not.toContain("конспект");
	});

	test("treats a body that merely opens with a slash as no command", () => {
		const passage = `/${"private-passage".repeat(10)}`;

		expect(describeUpdate(messageContext(passage))).toMatchObject({
			command: undefined,
			textLength: passage.length,
		});
	});

	test("keeps a command addressed to the bot", () => {
		expect(describeUpdate(messageContext("/stats@quiz_bot")).command).toBe(
			"/stats@quiz_bot",
		);
	});

	test("survives an update telegraf cannot classify", () => {
		const unclassifiable = {
			from: { id: 42 },
			get updateType(): string {
				throw new Error("Cannot determine updateType of {...}");
			},
		} as unknown as Context;

		expect(describeUpdate(unclassifiable)).toEqual({
			telegramUserId: 42,
			update: "unknown",
		});
		expect(updateTypeOf(unclassifiable)).toBe("unknown");
	});

	test("reduces free text to its length", () => {
		expect(describeUpdate(messageContext("a passage from a book"))).toEqual({
			telegramUserId: 42,
			update: "message",
			command: undefined,
			textLength: 21,
		});
	});
});
