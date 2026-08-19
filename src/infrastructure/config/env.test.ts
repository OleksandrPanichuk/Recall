import { describe, expect, test } from "bun:test";
import {
	EnvironmentError,
	type EnvironmentSource,
	loadEnvironment,
	loadHttpEnvironment,
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

describe("loadHttpEnvironment", () => {
	const TOKEN = "t".repeat(32);

	test("reads the token and falls back to loopback and 8765", () => {
		const http = loadHttpEnvironment({ MCP_HTTP_TOKEN: TOKEN });

		expect(http.token).toBe(TOKEN);
		expect(http.host).toBe("127.0.0.1");
		expect(http.port).toBe(8765);
		expect(http.allowedHosts).toEqual([]);
	});

	test("takes an explicit host, port and allowed host", () => {
		const http = loadHttpEnvironment({
			MCP_HTTP_TOKEN: TOKEN,
			MCP_HTTP_HOST: "0.0.0.0",
			MCP_HTTP_PORT: "9000",
			MCP_HTTP_ALLOWED_HOST: "quiz.example.com",
		});

		expect(http.host).toBe("0.0.0.0");
		expect(http.port).toBe(9000);
		expect(http.allowedHosts).toEqual(["quiz.example.com"]);
	});

	test("refuses a missing token", () => {
		expect(() => loadHttpEnvironment({})).toThrow(EnvironmentError);
	});

	test("refuses a token short enough to guess", () => {
		expect(() =>
			loadHttpEnvironment({ MCP_HTTP_TOKEN: "t".repeat(31) }),
		).toThrow(EnvironmentError);
	});

	test("names the token in the failure without printing it", () => {
		try {
			loadHttpEnvironment({ MCP_HTTP_TOKEN: "short" });
			throw new Error("expected a refusal");
		} catch (error) {
			expect((error as EnvironmentError).message).toContain("MCP_HTTP_TOKEN");
			expect((error as EnvironmentError).message).not.toContain("short");
		}
	});

	test("leaves oauth off when neither issuer nor passphrase is given", () => {
		const http = loadHttpEnvironment({ MCP_HTTP_TOKEN: TOKEN });

		expect(http.oauth).toBeUndefined();
	});

	test("turns oauth on when both the issuer and the passphrase are given", () => {
		const http = loadHttpEnvironment({
			MCP_HTTP_TOKEN: TOKEN,
			MCP_OAUTH_ISSUER: "https://quiz.example.com",
			MCP_OAUTH_PASSPHRASE: "correct horse battery",
		});

		expect(http.oauth?.issuer.href).toBe("https://quiz.example.com/");
		expect(http.oauth?.passphrase).toBe("correct horse battery");
	});

	test("refuses an issuer without a passphrase, rather than serving it open", () => {
		expect(() =>
			loadHttpEnvironment({
				MCP_HTTP_TOKEN: TOKEN,
				MCP_OAUTH_ISSUER: "https://quiz.example.com",
			}),
		).toThrow(EnvironmentError);
	});

	test("refuses a passphrase without an issuer", () => {
		expect(() =>
			loadHttpEnvironment({
				MCP_HTTP_TOKEN: TOKEN,
				MCP_OAUTH_PASSPHRASE: "correct horse battery",
			}),
		).toThrow(EnvironmentError);
	});

	test("refuses a passphrase short enough to guess", () => {
		expect(() =>
			loadHttpEnvironment({
				MCP_HTTP_TOKEN: TOKEN,
				MCP_OAUTH_ISSUER: "https://quiz.example.com",
				MCP_OAUTH_PASSPHRASE: "short",
			}),
		).toThrow(EnvironmentError);
	});

	test("refuses an issuer that is not a url", () => {
		expect(() =>
			loadHttpEnvironment({
				MCP_HTTP_TOKEN: TOKEN,
				MCP_OAUTH_ISSUER: "quiz.example.com",
				MCP_OAUTH_PASSPHRASE: "correct horse battery",
			}),
		).toThrow(EnvironmentError);
	});

	test("never prints the passphrase in a failure", () => {
		try {
			loadHttpEnvironment({
				MCP_HTTP_TOKEN: TOKEN,
				MCP_OAUTH_PASSPHRASE: "sesame open up please",
			});
			throw new Error("expected a refusal");
		} catch (error) {
			expect((error as EnvironmentError).message).not.toContain("sesame");
		}
	});

	test("refuses a port that is not a usable number", () => {
		expect(() =>
			loadHttpEnvironment({ MCP_HTTP_TOKEN: TOKEN, MCP_HTTP_PORT: "0" }),
		).toThrow(EnvironmentError);
		expect(() =>
			loadHttpEnvironment({ MCP_HTTP_TOKEN: TOKEN, MCP_HTTP_PORT: "70000" }),
		).toThrow(EnvironmentError);
		expect(() =>
			loadHttpEnvironment({ MCP_HTTP_TOKEN: TOKEN, MCP_HTTP_PORT: "http" }),
		).toThrow(EnvironmentError);
	});
});
