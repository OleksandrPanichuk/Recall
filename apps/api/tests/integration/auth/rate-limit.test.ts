import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { createApiApp } from "@/entrypoints/api";
import { CLIENT_IP_HEADER } from "@/modules/auth/build-auth.constants";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
} from "../../fixtures/postgres";

const available = await postgresAvailable();
const BOT_TOKEN = "r".repeat(40);
const TELEGRAM_ID = 636363;
const SIGN_IN_MAX = 10;

const overrides: { name: string; previous: string | undefined }[] = [];

const override = (name: string, value: string): void => {
	overrides.push({ name, previous: process.env[name] });
	process.env[name] = value;
};

let harness: PostgresHarness;
let app: INestApplication;
let origin: string;
let cookie: string;

const getSession = (ip?: string): Promise<Response> =>
	fetch(`${origin}/api/auth/get-session`, {
		headers: {
			cookie,
			...(ip === undefined ? {} : { [CLIENT_IP_HEADER]: ip }),
		},
	});

const signIn = (ip: string): Promise<Response> =>
	fetch(`${origin}/api/auth/sign-in/email`, {
		method: "POST",
		headers: { "content-type": "application/json", [CLIENT_IP_HEADER]: ip },
		body: JSON.stringify({
			email: "nobody@example.com",
			password: "not the password",
		}),
	});

const statuses = async (
	times: number,
	call: () => Promise<Response>,
): Promise<readonly number[]> => {
	const seen: number[] = [];

	for (let attempt = 0; attempt < times; attempt += 1) {
		seen.push((await call()).status);
	}

	return seen;
};

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("auth-rate-limit");
	await applyMigration(harness);

	override("DATABASE_URL", harness.url);
	override("BOT_API_TOKEN", BOT_TOKEN);
	override("BETTER_AUTH_SECRET", "s".repeat(40));
	override("ALLOWED_TELEGRAM_USER_ID", String(TELEGRAM_ID));
	override("AUTH_RATE_LIMIT", "on");

	app = await createApiApp();
	await app.listen(0, "127.0.0.1");

	const address = app.getHttpServer().address() as AddressInfo;

	origin = `http://127.0.0.1:${address.port}`;
	process.env.BETTER_AUTH_URL = origin;

	const { url } = (await (
		await fetch(`${origin}/bot/auth/login-link`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${BOT_TOKEN}`,
			},
			body: JSON.stringify({ telegramUserId: TELEGRAM_ID }),
		})
	).json()) as { url: string };
	const verified = await fetch(url.replace(/^https?:\/\/[^/]+/, origin), {
		redirect: "manual",
	});

	cookie = (verified.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
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

describe.skipIf(!available)("what the auth rate limit may refuse", () => {
	test("reading the session is not rationed, because every page does it", async () => {
		const seen = await statuses(120, () => getSession());

		expect(new Set(seen)).toEqual(new Set([200]));
	});

	test("signing in still is, and says so with 429", async () => {
		const seen = await statuses(SIGN_IN_MAX + 2, () => signIn("203.0.113.7"));

		expect(seen.filter((status) => status === 429).length).toBeGreaterThan(0);
	});

	test("one client's failed sign-ins do not lock anybody else out", async () => {
		expect(
			(await statuses(SIGN_IN_MAX + 2, () => signIn("198.51.100.1"))).at(-1),
		).toBe(429);

		const stranger = await signIn("198.51.100.99");

		expect(stranger.status).not.toBe(429);
	});

	test("and a rationed client is refused, not signed out", async () => {
		const refused = await signIn("198.51.100.1");

		expect(refused.status).toBe(429);
		expect((await getSession()).status).toBe(200);
	});
});
