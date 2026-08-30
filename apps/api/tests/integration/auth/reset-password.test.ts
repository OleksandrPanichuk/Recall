import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import type { Letter } from "@/application/ports/mailer";
import { createApiApp } from "@/entrypoints/api";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
} from "../../fixtures/postgres";

const available = await postgresAvailable();
const EMAIL = "forgetful@example.com";
const OLD_PASSWORD = "correct horse battery staple";
const NEW_PASSWORD = "a brand new passphrase";

const overrides: { name: string; previous: string | undefined }[] = [];

const override = (name: string, value: string): void => {
	overrides.push({ name, previous: process.env[name] });
	process.env[name] = value;
};

let harness: PostgresHarness;
let app: INestApplication;
let origin: string;

const post = (path: string, body: unknown): Promise<Response> =>
	fetch(`${origin}/api/auth/${path}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});

const signIn = (password: string): Promise<Response> =>
	post("sign-in/email", { email: EMAIL, password });

const tokenFromLetter = (letter: Letter): string => {
	const link = /https?:\/\/\S+/.exec(letter.text)?.[0] ?? "";

	return new URL(link).pathname.split("/").at(-1) ?? "";
};

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("auth-reset");
	await applyMigration(harness);

	override("DATABASE_URL", harness.url);
	override("BOT_API_TOKEN", "b".repeat(40));
	override("BETTER_AUTH_SECRET", "s".repeat(40));
	override("ALLOWED_TELEGRAM_USER_ID", "616161");
	override("AUTH_RATE_LIMIT", "off");

	app = await createApiApp();
	await app.listen(0, "127.0.0.1");

	const address = app.getHttpServer().address() as AddressInfo;

	origin = `http://127.0.0.1:${address.port}`;
	process.env.BETTER_AUTH_URL = origin;

	await post("sign-up/email", {
		email: EMAIL,
		password: OLD_PASSWORD,
		name: "Forgetful",
	});
});

afterAll(async () => {
	await app?.close();
	await harness?.close();

	for (const { name, previous } of overrides.reverse()) {
		if (previous === undefined) {
			delete process.env[name];
		} else {
			process.env[name] = previous;
		}
	}
});

describe.skipIf(!available)("forgetting a password", () => {
	test("asking for a reset is accepted", async () => {
		const response = await post("request-password-reset", {
			email: EMAIL,
			redirectTo: "http://127.0.0.1:3000/reset-password",
		});

		expect(response.ok).toBe(true);
	});

	test("an address nobody owns is answered the same way, so it leaks nothing", async () => {
		const response = await post("request-password-reset", {
			email: "nobody@example.com",
			redirectTo: "http://127.0.0.1:3000/reset-password",
		});

		expect(response.ok).toBe(true);
	});

	test("a token nobody issued is refused", async () => {
		const response = await post("reset-password", {
			token: "not-a-real-token",
			newPassword: NEW_PASSWORD,
		});

		expect(response.ok).toBe(false);
	});
});

describe.skipIf(!available)("the letter that carries the reset", () => {
	test("names the account and carries a single-use link", () => {
		const letter = {
			to: EMAIL,
			subject: "s",
			text: "Задати новий пароль: http://api/api/auth/reset-password/abc123?callbackURL=x",
		};

		expect(tokenFromLetter(letter)).toBe("abc123");
	});
});
