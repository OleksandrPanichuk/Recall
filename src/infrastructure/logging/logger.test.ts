import { describe, expect, test } from "bun:test";
import {
	createLogger,
	LogLevel,
	MAX_FIELD_LENGTH,
	REDACTED,
	sanitiseFields,
} from "./logger";

const captured = (level?: LogLevel) => {
	const lines: string[] = [];
	const logger = createLogger({
		level,
		now: () => new Date("2026-08-01T10:00:00.000Z"),
		write: (line) => lines.push(line),
	});

	return {
		logger,
		lines,
		last: () => JSON.parse(lines.at(-1) ?? "{}") as Record<string, unknown>,
	};
};

describe("createLogger", () => {
	test("writes one JSON object per line", () => {
		const { logger, last } = captured();

		logger.info("bot started", { databasePath: "./quiz.sqlite" });

		expect(last()).toEqual({
			time: "2026-08-01T10:00:00.000Z",
			level: "info",
			message: "bot started",
			databasePath: "./quiz.sqlite",
		});
	});

	test("drops records below the configured level", () => {
		const { logger, lines } = captured(LogLevel.Warn);

		logger.debug("noise");
		logger.info("noise");
		logger.warn("kept");
		logger.error("kept");

		expect(lines).toHaveLength(2);
	});
});

describe("privacy (§6.2)", () => {
	test.each([
		"telegramBotKey",
		"TELEGRAM_BOT_KEY",
		"token",
		"apiKey",
		"api_key",
		"password",
		"secret",
		"authorization",
		"credentials",
	])("redacts the field %p whatever it holds", (key) => {
		const { logger, last } = captured();

		logger.info("startup", { [key]: "123456:AA-real-looking-token" });

		expect(last()[key]).toBe(REDACTED);
		expect(JSON.stringify(last())).not.toContain("AA-real-looking-token");
	});

	test("clips long values so book and question text cannot be reproduced", () => {
		const extract = "A".repeat(500);
		const { logger, last } = captured();

		logger.info("imported", { prompt: extract });

		expect(String(last().prompt)).toHaveLength(MAX_FIELD_LENGTH + 7);
		expect(String(last().prompt)).toContain("(+420)");
	});

	test("clips the message itself", () => {
		const { logger, last } = captured();

		logger.info("B".repeat(300));

		expect(String(last().message).length).toBeLessThan(100);
	});

	test("keeps an error's name and message but never its stack", () => {
		const { logger, last } = captured();

		logger.error("handler failed", { error: new Error("boom") });

		expect(last().error).toEqual({ name: "Error", message: "boom" });
		expect(JSON.stringify(last())).not.toContain("at ");
	});

	test("does not walk deeply into a raw Telegram update", () => {
		const { logger, last } = captured();

		logger.info("update", {
			update: { message: { chat: { deep: { deeper: "secret content" } } } },
		});

		expect(JSON.stringify(last())).not.toContain("secret content");
	});

	test("caps array output", () => {
		const { logger, last } = captured();

		logger.info("batch", { ids: Array.from({ length: 50 }, (_v, i) => i) });

		expect(last().ids).toHaveLength(10);
	});
});

describe("sanitiseFields", () => {
	test("passes through primitives and dates", () => {
		expect(
			sanitiseFields({
				count: 3,
				ok: true,
				at: new Date("2026-08-01T10:00:00.000Z"),
				missing: undefined,
			}),
		).toEqual({
			count: 3,
			ok: true,
			at: "2026-08-01T10:00:00.000Z",
			missing: undefined,
		});
	});

	test("refuses to serialise a function", () => {
		expect(sanitiseFields({ callback: () => {} }).callback).toBe(
			"[unloggable]",
		);
	});
});

describe("sensitive-name matching", () => {
	test.each([
		"keyboard",
		"questionId",
		"count",
		"attemptId",
	])("leaves the innocent field %p alone", (key) => {
		const { logger, last } = captured();

		logger.info("screen", { [key]: "visible" });

		expect(last()[key]).toBe("visible");
	});

	// Over-redaction is the safe direction: a field named "monkey" being masked
	// costs nothing, a leaked token costs everything.
	test("redacts anything ending in key, even a false positive", () => {
		const { logger, last } = captured();

		logger.info("screen", { monkey: "visible" });

		expect(last().monkey).toBe(REDACTED);
	});
});
