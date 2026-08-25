import { describe, expect, test } from "bun:test";
import {
	EnvironmentError,
	type EnvironmentSource,
	loadAdminEnvironment,
	loadEnvironment,
} from "./env";

const validSource: EnvironmentSource = {
	TELEGRAM_BOT_KEY: "123456789:AA-valid-looking-bot-token",
	ALLOWED_TELEGRAM_USER_ID: "987654321",
	DATABASE_URL: "postgres://recall:recall@127.0.0.1:55432/recall",
	APP_TIMEZONE: "Europe/Kyiv",
};

describe("loadEnvironment", () => {
	describe("with a valid source", () => {
		test("returns a typed configuration", () => {
			const environment = loadEnvironment(validSource);

			expect(environment).toEqual({
				telegramBotKey: "123456789:AA-valid-looking-bot-token",
				allowedTelegramUserId: 987654321,
				databaseUrl: "postgres://recall:recall@127.0.0.1:55432/recall",
				oauthDatabasePath: "./data/oauth.sqlite",
				appTimezone: "Europe/Kyiv",
			});
		});

		test("trims surrounding whitespace from values", () => {
			const environment = loadEnvironment({
				...validSource,
				DATABASE_URL: "  postgres://recall:recall@127.0.0.1:55432/recall  ",
				APP_TIMEZONE: " Europe/Kyiv ",
			});

			expect(environment.databaseUrl).toBe(
				"postgres://recall:recall@127.0.0.1:55432/recall",
			);
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
				"DATABASE_URL is required: the Postgres connection string for the quiz data",
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

describe("loadAdminEnvironment", () => {
	const PASSPHRASE = "correct horse battery staple";

	test("falls back to loopback and 8766", () => {
		const admin = loadAdminEnvironment({ ADMIN_PASSPHRASE: PASSPHRASE });

		expect(admin.host).toBe("127.0.0.1");
		expect(admin.port).toBe(8766);
		expect(admin.passphrase).toBe(PASSPHRASE);
	});

	test("takes an explicit host and port", () => {
		const admin = loadAdminEnvironment({
			ADMIN_PASSPHRASE: PASSPHRASE,
			ADMIN_HOST: "0.0.0.0",
			ADMIN_PORT: "9100",
		});

		expect(admin.host).toBe("0.0.0.0");
		expect(admin.port).toBe(9100);
	});

	test("borrows the OAuth passphrase when no admin one is set", () => {
		const admin = loadAdminEnvironment({ MCP_OAUTH_PASSPHRASE: PASSPHRASE });

		expect(admin.passphrase).toBe(PASSPHRASE);
	});

	test("prefers its own passphrase over the OAuth one", () => {
		const admin = loadAdminEnvironment({
			ADMIN_PASSPHRASE: PASSPHRASE,
			MCP_OAUTH_PASSPHRASE: "another passphrase entirely",
		});

		expect(admin.passphrase).toBe(PASSPHRASE);
	});

	test("refuses a short passphrase", () => {
		expect(() => loadAdminEnvironment({ ADMIN_PASSPHRASE: "short" })).toThrow(
			EnvironmentError,
		);
	});

	test("refuses to run without any passphrase", () => {
		expect(() => loadAdminEnvironment({})).toThrow(EnvironmentError);
	});

	test("keeps the passphrase out of the error message", () => {
		const secret = "s".repeat(8);

		try {
			loadAdminEnvironment({ ADMIN_PASSPHRASE: secret });
			expect.unreachable();
		} catch (error) {
			expect((error as Error).message).not.toContain(secret);
		}
	});
});
