import { describe, expect, test } from "bun:test";
import { createRecordingLogger } from "@tests/fixtures/logger.fixture";
import type { Context } from "telegraf";
import type { Logger } from "@/infrastructure/logging/logger.types";
import { loggingMiddleware } from "./logging.middleware";

const contextOf = (update: Record<string, unknown>): Context =>
	({ from: { id: 42 }, ...update }) as unknown as Context;

const callbackContext = (data: string): Context =>
	contextOf({ callbackQuery: { data }, updateType: "callback_query" });

const messageContext = (text: string): Context =>
	contextOf({ message: { text }, updateType: "message" });

describe("loggingMiddleware", () => {
	const elapsing = () => {
		let current = 1000;

		return () => {
			current += 5;

			return current;
		};
	};

	test("logs one record per handled update", async () => {
		const logger = createRecordingLogger();

		await loggingMiddleware({ logger, now: elapsing() })(
			callbackContext("m"),
			async () => {},
		);

		expect(logger.of("telegram update")).toEqual([
			{
				time: expect.any(String),
				level: "info",
				message: "telegram update",
				telegramUserId: 42,
				update: "callback_query",
				action: "menu",
				durationMs: 5,
				outcome: "ok",
			},
		]);
	});

	test("records the failed outcome and lets the error through", async () => {
		const logger = createRecordingLogger();
		const failing = loggingMiddleware({ logger, now: elapsing() })(
			messageContext("/start"),
			async () => {
				throw new Error("handler exploded");
			},
		);

		await expect(failing).rejects.toThrow("handler exploded");

		expect(logger.of("telegram update").at(0)).toMatchObject({
			outcome: "failed",
			durationMs: 5,
		});
	});

	test("a failing log sink neither fails the update nor reports it as failed", async () => {
		const attempts: string[] = [];
		const brokenSink: Logger = {
			debug: () => {},
			info: (_message, fields) => {
				attempts.push(String(fields?.outcome));
				throw new Error("EPIPE: stderr is gone");
			},
			warn: () => {},
			error: () => {},
		};
		let handled = false;

		await loggingMiddleware({ logger: brokenSink, now: elapsing() })(
			messageContext("/start"),
			async () => {
				handled = true;
			},
		);

		expect(handled).toBe(true);
		expect(attempts).toEqual(["ok"]);
	});
});
