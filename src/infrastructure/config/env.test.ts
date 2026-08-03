import { describe, expect, test } from "bun:test";
import {
	EnvironmentError,
	type EnvironmentSource,
	loadEnvironment,
} from "./env";

const validSource: EnvironmentSource = {
	TELEGRAM_BOT_KEY: "123456789:AA-valid-looking-bot-token",
	ALLOWED_TELEGRAM_USER_ID: "987654321",
	DATABASE_PATH: "./data/quiz.sqlite",
	APP_TIMEZONE: "Europe/Kyiv",
};

describe("loadEnvironment", () => {
	describe("with a valid source", () => {
		test("returns a typed configuration", () => {
			const environment = loadEnvironment(validSource);

			expect(environment).toEqual({
				telegramBotKey: "123456789:AA-valid-looking-bot-token",
				allowedTelegramUserId: 987654321,
				databasePath: "./data/quiz.sqlite",
				appTimezone: "Europe/Kyiv",
			});
		});

		test("trims surrounding whitespace from values", () => {
			const environment = loadEnvironment({
				...validSource,
				DATABASE_PATH: "  ./data/quiz.sqlite  ",
				APP_TIMEZONE: " Europe/Kyiv ",
			});

			expect(environment.databasePath).toBe("./data/quiz.sqlite");
			expect(environment.appTimezone).toBe("Europe/Kyiv");
		});

		test("reads Bun.env by default", () => {
			const previous = Bun.env.TELEGRAM_BOT_KEY;
			Bun.env.TELEGRAM_BOT_KEY = "   ";

			try {
				expect(() => loadEnvironment()).toThrow(EnvironmentError);
			} finally {
				if (previous === undefined) {
					delete Bun.env.TELEGRAM_BOT_KEY;
				} else {
					Bun.env.TELEGRAM_BOT_KEY = previous;
				}
			}
		});
	});

	describe("with an invalid source", () => {
		test("reports every missing variable instead of only the first one", () => {
			let error: EnvironmentError | undefined;

			try {
				loadEnvironment({});
			} catch (caught) {
				error = caught as EnvironmentError;
			}

			expect(error).toBeInstanceOf(EnvironmentError);
			expect(error?.issues).toEqual([
				"TELEGRAM_BOT_KEY is required and must not be empty",
				"ALLOWED_TELEGRAM_USER_ID must be a positive integer Telegram user id",
				"DATABASE_PATH is required and must not be empty",
				"APP_TIMEZONE must be a valid IANA time zone such as Europe/Kyiv",
			]);
		});

		test("treats a whitespace-only value as missing", () => {
			expect(() =>
				loadEnvironment({ ...validSource, TELEGRAM_BOT_KEY: "   " }),
			).toThrow(EnvironmentError);
		});

		test.each([
			["not-a-number", "non-numeric user id"],
			["0", "zero user id"],
			["-5", "negative user id"],
			["12.5", "fractional user id"],
			["9007199254740993", "user id above the safe integer range"],
		])("rejects %p as ALLOWED_TELEGRAM_USER_ID", (value) => {
			expect(() =>
				loadEnvironment({ ...validSource, ALLOWED_TELEGRAM_USER_ID: value }),
			).toThrow(
				"ALLOWED_TELEGRAM_USER_ID must be a positive integer Telegram user id",
			);
		});

		test("rejects an unknown time zone", () => {
			expect(() =>
				loadEnvironment({ ...validSource, APP_TIMEZONE: "Europe/Atlantis" }),
			).toThrow(
				"APP_TIMEZONE must be a valid IANA time zone such as Europe/Kyiv",
			);
		});
	});

	describe("secret handling", () => {
		test("never includes secret values in the reported failure", () => {
			const secret = "123456789:AA-super-secret-token";
			let message = "";

			try {
				loadEnvironment({
					...validSource,
					TELEGRAM_BOT_KEY: secret,
					APP_TIMEZONE: "Europe/Atlantis",
				});
			} catch (caught) {
				message = (caught as Error).message;
			}

			expect(message).toContain("APP_TIMEZONE");
			expect(message).not.toContain(secret);
			expect(message).not.toContain("AA-super-secret-token");
		});
	});
});
