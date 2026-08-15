import { describe, expect, test } from "bun:test";
import type { Context } from "telegraf";
import { describeUpdate } from "./describe-update";

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

	test("reduces free text to its length", () => {
		expect(describeUpdate(messageContext("a passage from a book"))).toEqual({
			telegramUserId: 42,
			update: "message",
			command: undefined,
			textLength: 21,
		});
	});
});
