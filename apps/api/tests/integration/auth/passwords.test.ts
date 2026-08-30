import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { createApiApp } from "@/entrypoints/api";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
} from "../../fixtures/postgres";
import { openSmtpCapture, type SmtpCapture } from "../../fixtures/smtp";

const available = await postgresAvailable();
const EMAIL = "forgetful@example.com";
const OLD_PASSWORD = "correct horse battery staple";
const NEW_PASSWORD = "a brand new passphrase";
const CHOSEN_PASSWORD = "one the owner chose themselves";
const REDIRECT_TO = "http://127.0.0.1:3000/reset-password";

const overrides: { name: string; previous: string | undefined }[] = [];

const override = (name: string, value: string): void => {
	overrides.push({ name, previous: process.env[name] });
	process.env[name] = value;
};

let harness: PostgresHarness;
let smtp: SmtpCapture;
let app: INestApplication;
let origin: string;
let token: string;

const post = (
	path: string,
	body: unknown,
	cookie?: string,
): Promise<Response> =>
	fetch(`${origin}/api/auth/${path}`, {
		method: "POST",
		headers:
			cookie === undefined
				? { "content-type": "application/json" }
				: { "content-type": "application/json", cookie },
		body: JSON.stringify(body),
	});

const signIn = (password: string): Promise<Response> =>
	post("sign-in/email", { email: EMAIL, password });

const requestReset = (email: string): Promise<Response> =>
	post("request-password-reset", { email, redirectTo: REDIRECT_TO });

const tokenFromLetter = (body: string): string => {
	const link = /https?:\/\/\S*reset-password\S*/.exec(body)?.[0] ?? "";

	return new URL(link).pathname.split("/").at(-1) ?? "";
};

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("auth-reset");
	await applyMigration(harness);

	smtp = await openSmtpCapture();

	override("DATABASE_URL", harness.url);
	override("BOT_API_TOKEN", "b".repeat(40));
	override("BETTER_AUTH_SECRET", "s".repeat(40));
	override("ALLOWED_TELEGRAM_USER_ID", "616161");
	override("AUTH_RATE_LIMIT", "off");
	override("SMTP_URL", smtp.url);
	override("MAIL_FROM", "recall@example.com");

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
	smtp?.close();
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
	test("an address nobody owns is answered the same way, and sends nothing", async () => {
		const response = await requestReset("nobody@example.com");

		expect(response.ok).toBe(true);
		expect(smtp.letters).toHaveLength(0);
	});

	test("asking for a reset sends a letter to that address alone", async () => {
		const response = await requestReset(EMAIL);

		expect(response.ok).toBe(true);

		const letter = await smtp.waitForLetter();

		expect(letter.to).toBe(EMAIL);
		expect(letter.from).toBe("recall@example.com");

		token = tokenFromLetter(letter.body);

		expect(token.length).toBeGreaterThan(16);
	});

	test("a token nobody issued is refused", async () => {
		const response = await post("reset-password", {
			token: "not-a-real-token",
			newPassword: NEW_PASSWORD,
		});

		expect(response.ok).toBe(false);
	});

	test("the emailed token sets the new password", async () => {
		const response = await post("reset-password", {
			token,
			newPassword: NEW_PASSWORD,
		});

		expect(response.ok).toBe(true);
	});

	test("the old password stops working", async () => {
		const response = await signIn(OLD_PASSWORD);

		expect(response.ok).toBe(false);
	});

	test("the new password works", async () => {
		const response = await signIn(NEW_PASSWORD);

		expect(response.ok).toBe(true);
	});

	test("the same token cannot be spent twice", async () => {
		const response = await post("reset-password", {
			token,
			newPassword: "yet another passphrase",
		});

		expect(response.ok).toBe(false);
	});
});

describe.skipIf(!available)("changing a password you still know", () => {
	let cookie: string;

	test("signing in hands back a session", async () => {
		const response = await signIn(NEW_PASSWORD);

		cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";

		expect(cookie).not.toBe("");
	});

	test("the wrong current password is refused", async () => {
		const response = await post(
			"change-password",
			{ currentPassword: "not it at all", newPassword: CHOSEN_PASSWORD },
			cookie,
		);

		expect(response.ok).toBe(false);
	});

	test("no session at all is refused", async () => {
		const response = await post("change-password", {
			currentPassword: NEW_PASSWORD,
			newPassword: CHOSEN_PASSWORD,
		});

		expect(response.ok).toBe(false);
	});

	test("the right current password sets the new one", async () => {
		const response = await post(
			"change-password",
			{ currentPassword: NEW_PASSWORD, newPassword: CHOSEN_PASSWORD },
			cookie,
		);

		expect(response.ok).toBe(true);
		expect((await signIn(NEW_PASSWORD)).ok).toBe(false);
		expect((await signIn(CHOSEN_PASSWORD)).ok).toBe(true);
	});
});
